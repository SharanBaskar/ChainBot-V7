import { Component, OnInit, OnDestroy } from '@angular/core';
import { CouchdbService } from '../couchdb.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-leave-details-month-wise',
  templateUrl: './leave-details-month-wise.component.html',
  styleUrls: ['./leave-details-month-wise.component.css']
})
export class LeaveDetailsMonthWiseComponent implements OnInit, OnDestroy {
  allEmployeeLeaves: any[] = [];
  employeeDetails: any[] = [];
  groupedLeaveRecords: any[] = [];
  employeeLeaveSummary: any[] = [];
  private changesSubscription: Subscription | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=longpoll&include_docs=true';
  private pollingInterval = 1000; // Poll every 1 second
  selectedMonthYear: string = ''; // Store selected month-year
  noLeaveMessage: string = ''; // Message to display when no leave records are found

  // List of month-year options
  monthYearOptions: string[] = [];

  constructor(
    private couchdbService: CouchdbService, 
    private router: Router,    
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.fetchEmployeeDetails();
    this.listenForChanges(); // Start polling
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

  fetchEmployeeDetails(): void {
    this.couchdbService.getEmployeeDetails().subscribe(
      employees => {
        if (employees && Array.isArray(employees)) {
          this.employeeDetails = employees;
          this.fetchEmployeeLeavesAndBalances();
        } else {
          console.error('Unexpected format for employee details:', employees);
        }
      },
      error => {
        console.error('Error fetching employee details:', error);
      }
    );
  }

fetchEmployeeLeavesAndBalances(): void {
  const employeeIds = this.employeeDetails.map(e => e.employeeId);
  if (employeeIds.length > 0) {
    const leaveRequests = employeeIds.map(id =>
      this.couchdbService.getEmployeeLeaves(id).toPromise()
    );
    const balanceRequests = employeeIds.map(id =>
      this.couchdbService.getLeaveBalance(id).toPromise()
    );
    Promise.all([...leaveRequests, ...balanceRequests]).then(responses => {
      const leaveRecords = responses.slice(0, employeeIds.length).flat();
      const balanceRecords = responses.slice(employeeIds.length);
      this.mergeEmployeeLeavesAndBalances(leaveRecords, balanceRecords);
    }).catch(error => {
      console.error('Error fetching leave records and balances:', error);
    });
  }
}

mergeEmployeeLeavesAndBalances(leaveRecords: any[], balanceRecords: any[]): void {
  if (leaveRecords.length > 0 && this.employeeDetails.length > 0) {
    const leaveRecordsWithBalances = leaveRecords.map(leave => {
      const employee = this.employeeDetails.find(e => e.employeeId === leave.employeeId);
      const balance = balanceRecords.find(b => b.employeeId === leave.employeeId);
      return {
        ...leave,
        employeename: employee ? employee.employeename : 'Unknown',
        startDate: leave.startDate || 'N/A',
        endDate: leave.endDate || 'N/A',
        leaveType: leave.leaveType || 'N/A',
        leaveReason: leave.leaveReason || 'N/A',
        leaveDays: leave.leaveDays || 0,
        lossOfPay: leave.lossOfPay || 'No',
        casualLeaveBalance: balance?.casualLeaveBalance || 0,
        medicalLeaveBalance: balance?.medicalLeaveBalance || 0,
        totalLeaveBalance: balance?.leaveBalance || 0
      };
    });

    // Populate month-year options
    this.monthYearOptions = Array.from(new Set(leaveRecordsWithBalances.map(record => {
      if (record.startDate) {
        const startDate = new Date(record.startDate);
        const month = startDate.toLocaleString('default', { month: 'long' });
        const year = startDate.getFullYear();
        return `${month} ${year}`;
      }
      return '';
    }))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Filter based on selected month or show all records
    if (this.selectedMonthYear && this.selectedMonthYear !== 'all') {
      this.groupedLeaveRecords = this.groupLeaveRecordsByMonth(leaveRecordsWithBalances, this.selectedMonthYear);
      this.noLeaveMessage = this.groupedLeaveRecords.length === 0 ? 'No employee took leave in the specified month.' : '';
    } else {
      // Show all months if "all" is selected
      this.groupedLeaveRecords = this.groupLeaveRecordsByMonth(leaveRecordsWithBalances);
      this.noLeaveMessage = '';
    }

    this.employeeLeaveSummary = this.calculateEmployeeLeaveSummary(leaveRecordsWithBalances);
  } else {
    console.error('No leave records or employee details available to match.');
  }
}

groupLeaveRecordsByMonth(records: any[], searchMonthYear?: string): any[] {
  let groupedRecords: { [key: string]: any[] } = {};

  records.forEach((record: any) => {
    if (record.startDate) {
      const startDate = new Date(record.startDate);
      const month = startDate.toLocaleString('default', { month: 'long' });
      const year = startDate.getFullYear();
      const monthYear = `${month} ${year}`;
      if (!groupedRecords[monthYear]) {
        groupedRecords[monthYear] = [];
      }
      groupedRecords[monthYear].push(record);
    }
  });

  // If a specific month is selected, filter the records
  if (searchMonthYear && searchMonthYear !== 'all') {
    groupedRecords = { [searchMonthYear]: groupedRecords[searchMonthYear] || [] };
  }

  // Sort the grouped records by date in descending order
  const sortedMonthYears = Object.keys(groupedRecords).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  // Sort each month's records by startDate in ascending order
  sortedMonthYears.forEach(monthYear => {
    groupedRecords[monthYear].sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA.getTime() - dateB.getTime(); // Sort in ascending order within the month
    });
  });

  return sortedMonthYears.map(monthYear => ({
    monthYear,
    leaves: groupedRecords[monthYear]
  }));
}


  calculateEmployeeLeaveSummary(records: any[]): any[] {
    const leaveSummary: { [key: string]: { totalLeaveDays: number; casualLeaveBalance: number; medicalLeaveBalance: number; totalLeaveBalance: number; employeename: string } } = {};

    records.forEach((record: any) => {
      const employeeId = record.employeeId;
      if (!leaveSummary[employeeId]) {
        leaveSummary[employeeId] = {
          totalLeaveDays: 0,
          casualLeaveBalance: 0,
          medicalLeaveBalance: 0,
          totalLeaveBalance: 0,
          employeename: record.employeename || 'Unknown'
        };
      }
      leaveSummary[employeeId].totalLeaveDays += parseInt(record.leaveDays, 10) || 0;
      leaveSummary[employeeId].casualLeaveBalance = record.casualLeaveBalance || 0;
      leaveSummary[employeeId].medicalLeaveBalance = record.medicalLeaveBalance || 0;
      leaveSummary[employeeId].totalLeaveBalance = record.totalLeaveBalance || 0;
    });

    return Object.keys(leaveSummary).map(employeeId => ({
      employeeId,
      ...leaveSummary[employeeId]
    }));
  }

  listenForChanges(): void {
    this.changesSubscription = timer(0, this.pollingInterval).pipe(
      switchMap(() => this.http.get<any>(this.url, { headers: this.getHeaders() }))
    ).subscribe(
      (response) => {
        this.fetchEmployeeDetails(); // Re-fetch data as needed
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
}
