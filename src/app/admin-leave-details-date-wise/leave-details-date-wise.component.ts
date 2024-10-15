import { Component, OnInit, OnDestroy } from '@angular/core';
import { CouchdbService } from '../couchdb.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-leave-details-date-wise',
  templateUrl: './leave-details-date-wise.component.html',
  styleUrls: ['./leave-details-date-wise.component.css']
})
export class LeaveDetailsDateWiseComponent implements OnInit, OnDestroy {
  allEmployeeLeaves: any[] = [];
  employeeDetails: any[] = [];
  groupedLeaveRecords: any[] = [];
  employeeLeaveSummary: any[] = [];
  private changesSubscription: Subscription | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=longpoll&include_docs=true';
  private pollingInterval = 1000; // Poll every 1 second
  searchDate: string = ''; // Store input date
  noLeaveMessage: string = ''; // Message to display when no leave records are found

  constructor(
    private couchdbService: CouchdbService, 
    private router: Router,    
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.fetchAllDetails(); // Load all details initially
    this.listenForChanges(); // Start polling
  }

  fetchDetails(): void {
    if (this.searchDate) {
      const selectedDate = new Date(this.searchDate);
      if (!isNaN(selectedDate.getTime())) {
        this.fetchEmployeeDetails(selectedDate); // Fetch details based on input date
      } else {
        console.error('Invalid date format.');
      }
    } else {
      this.fetchAllDetails(); // Show all records if no date is entered
    }
  }

  fetchAllDetails(): void {
    this.couchdbService.getEmployeeDetails().subscribe(
      employees => {
        if (employees && Array.isArray(employees)) {
          this.employeeDetails = employees;
          this.fetchEmployeeLeavesAndBalances(); // Fetch all leaves
        } else {
          console.error('Unexpected format for employee details:', employees);
        }
      },
      error => {
        console.error('Error fetching employee details:', error);
      }
    );
  }

  fetchEmployeeDetails(selectedDate: Date): void {
    this.couchdbService.getEmployeeDetails().subscribe(
      employees => {
        if (employees && Array.isArray(employees)) {
          this.employeeDetails = employees;
          this.fetchEmployeeLeavesAndBalances(selectedDate); // Pass selectedDate for filtering
        } else {
          console.error('Unexpected format for employee details:', employees);
        }
      },
      error => {
        console.error('Error fetching employee details:', error);
      }
    );
  }

  fetchEmployeeLeavesAndBalances(selectedDate?: Date): void {
    const employeeIds = this.employeeDetails.map(e => e.employeeId);
    if (employeeIds.length > 0) {
      const leaveRequests = employeeIds.map(id =>
        this.couchdbService.getEmployeeLeaves(id).toPromise()
      );
      Promise.all(leaveRequests).then(responses => {
        const leaveRecords = responses.flat();
        this.mergeEmployeeLeavesAndBalances(leaveRecords, [], selectedDate); // Pass selectedDate for filtering
      }).catch(error => {
        console.error('Error fetching leave records:', error);
      });
    }
  }

  mergeEmployeeLeavesAndBalances(leaveRecords: any[], balanceRecords: any[], selectedDate?: Date): void {
    if (leaveRecords.length > 0 && this.employeeDetails.length > 0) {
      const leaveRecordsWithDetails = leaveRecords.map(leave => {
        const employee = this.employeeDetails.find(e => e.employeeId === leave.employeeId);
        return {
          ...leave,
          employeename: employee ? employee.employeename : 'Unknown',
          startDate: leave.startDate || 'N/A',
          endDate: leave.endDate || 'N/A',
          leaveType: leave.leaveType || 'N/A',
          leaveReason: leave.leaveReason || 'N/A',
          leaveDays: leave.leaveDays || 0,
          lossOfPay: leave.lossOfPay || 'No'
        };
      });

      if (selectedDate) {
        this.groupedLeaveRecords = this.groupLeaveRecordsByDate(leaveRecordsWithDetails, selectedDate);
      } else {
        this.groupedLeaveRecords = this.groupLeaveRecordsByDate(leaveRecordsWithDetails);
      }

      // Check if no records were found for the selected date
      if (this.groupedLeaveRecords.length === 0 && selectedDate) {
        this.noLeaveMessage = 'No employee took leave on that particular date.';
      } else {
        this.noLeaveMessage = ''; // Clear message if records are found
      }
    } else {
      console.error('No leave records or employee details available to match.');
    }
  }

  groupLeaveRecordsByDate(records: any[], selectedDate?: Date): any[] {
    const groupedRecords: { [key: string]: any[] } = {};

    records.forEach((record: any) => {
      const startDate = new Date(record.startDate);
      const endDate = new Date(record.endDate);

      // Iterate over each date in the range
      for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toDateString();
        
        if (!groupedRecords[dateStr]) {
          groupedRecords[dateStr] = [];
        }

        groupedRecords[dateStr].push({
          ...record,
          leaveDays: 1, // Each day counts as one leave day
        });
      }
    });

    if (selectedDate) {
      const selectedDateStr = selectedDate.toDateString();
      const filteredRecords = groupedRecords[selectedDateStr] || [];
      return filteredRecords.length > 0 ? [{
        date: selectedDateStr,
        leaves: filteredRecords
      }] : []; // Return an empty array if no records found
    } else {
      // Return all records sorted by date
      return Object.keys(groupedRecords).map(dateStr => ({
        date: dateStr,
        leaves: groupedRecords[dateStr]
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending
    }
  }

  listenForChanges(): void {
    this.changesSubscription = timer(0, this.pollingInterval).pipe(
      switchMap(() => this.http.get<any>(this.url, { headers: this.getHeaders() }))
    ).subscribe(
      (response) => {
        // Optionally re-fetch data if needed
      },
      (error) => console.error('Polling error:', error)
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
    });
  }

  logout(): void {
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
  }

  showLeaveSummary(): void {
    this.router.navigate(['/leave-summary']);
  }

  showLeaveDetailsMonthWise(): void {
    this.router.navigate(['/leave-details-month-wise']);
  }

  showLeaveDetailsDateWise(): void {
    this.router.navigate(['/leave-details-date-wise']);
  }

  showEmployeeLeaveDetails(): void {
    this.router.navigate(['/employee-leave-details']);
  }

  showLeaveDetailsWeekWise(): void {
    this.router.navigate(['/leave-details-week-wise']);
  }

  showEmployeeSummary(): void{
    this.router.navigate(['/leave-details-summary-of-all-employee'])
  }
  
  home(): void {
    this.router.navigate(['/leave-summary']);
  }

  showAllRecords(): void {
    this.searchDate = ''; // Clear search date
    this.fetchAllDetails(); // Fetch all details
  }
}
