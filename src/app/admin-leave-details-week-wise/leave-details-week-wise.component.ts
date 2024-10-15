import { Component, OnInit, OnDestroy } from '@angular/core';
import { CouchdbService } from '../couchdb.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-leave-details-week-wise',
  templateUrl: './leave-details-week-wise.component.html',
  styleUrls: ['./leave-details-week-wise.component.css']
})
export class LeaveDetailsWeekWiseComponent implements OnInit, OnDestroy {
  allEmployeeLeaves: any[] = [];
  employeeDetails: any[] = [];
  groupedLeaveRecords: any[] = [];
  employeeLeaveSummary: any[] = [];
  private changesSubscription: Subscription | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=longpoll&include_docs=true';
  private pollingInterval = 1000; // Poll every 1 second
  selectedWeekYear: string = 'all'; // Default to "All"
  noLeaveMessage: string = ''; // Message to display when no leave records are found

  // List of week-year options
  weekYearOptions: string[] = [];

  constructor(
    private couchdbService: CouchdbService, 
    private router: Router,    
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.fetchEmployeeDetails();
    this.listenForChanges(); // Start polling
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
  
      // Populate week-year options
      this.weekYearOptions = Array.from(new Set(leaveRecordsWithBalances.map(record => {
        if (record.startDate) {
          const startDate = new Date(record.startDate);
          const weekNumber = this.getWeekNumber(startDate);
          const year = startDate.getFullYear();
          return `${year}-W${weekNumber}`;
        }
        return '';
      }))).sort((a, b) => {
        const weekA = a.split('-W');
        const weekB = b.split('-W');
        const yearComparison = parseInt(b.split('-')[0]) - parseInt(a.split('-')[0]);
        if (yearComparison !== 0) return yearComparison;
        return parseInt(weekB[1]) - parseInt(weekA[1]);
      });
  
      // Show or hide no leave message
      if (this.selectedWeekYear === 'all') {
        this.groupedLeaveRecords = this.groupLeaveRecordsByWeek(leaveRecordsWithBalances);
        this.noLeaveMessage = '';
      } else if (this.selectedWeekYear) {
        this.groupedLeaveRecords = this.groupLeaveRecordsByWeek(leaveRecordsWithBalances, this.selectedWeekYear);
        this.noLeaveMessage = this.groupedLeaveRecords.length === 0 ? 'No employee took leave in the specified week.' : '';
      } else {
        this.groupedLeaveRecords = [];
        this.noLeaveMessage = 'Please select a week.';
      }
  
      this.employeeLeaveSummary = this.calculateEmployeeLeaveSummary(leaveRecordsWithBalances);
    } else {
      console.error('No leave records or employee details available to match.');
    }
  }
  
  getWeekNumber(date: Date): number {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + 1) / 7);
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

  home(): void {
    this.router.navigate(['/leave-summary']);
  } 
  showEmployeeLeaveDetails(): void {
    this.router.navigate(['/employee-leave-details']);
  }

  showEmployeeSummary(): void{
    this.router.navigate(['/leave-details-summary-of-all-employee'])
  }
  
  showLeaveDetailsWeekWise(): void {
    this.router.navigate(['/leave-details-week-wise']);
  }
  
  groupLeaveRecordsByWeek(records: any[], searchWeekYear?: string): any[] {
    let groupedRecords: { [key: string]: any[] } = {};
  
    records.forEach((record: any) => {
      if (record.startDate) {
        const startDate = new Date(record.startDate);
        const year = startDate.getFullYear();
        const weekNumber = this.getWeekNumber(startDate);
        const weekYear = `${year}-W${weekNumber}`;
        
        if (!groupedRecords[weekYear]) {
          groupedRecords[weekYear] = [];
        }
        groupedRecords[weekYear].push(record);
      }
    });
  
    // Filter records based on the search week-year
    if (searchWeekYear && searchWeekYear !== 'all') {
      groupedRecords = { [searchWeekYear]: groupedRecords[searchWeekYear] || [] };
    }
  
    // Sort the grouped records by week-year in descending order (most recent week first)
    const sortedWeekYears = Object.keys(groupedRecords).sort((a, b) => {
      const weekA = a.split('-W');
      const weekB = b.split('-W');
      const yearComparison = parseInt(b.split('-')[0]) - parseInt(a.split('-')[0]);
      if (yearComparison !== 0) return yearComparison;
      return parseInt(weekB[1]) - parseInt(weekA[1]);
    });
  
    // Sort each week's records by startDate in ascending order
    sortedWeekYears.forEach(weekYear => {
      groupedRecords[weekYear].sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateA.getTime() - dateB.getTime(); // Sort in ascending order within the week
      });
    });
  
    return sortedWeekYears.map(weekYear => ({
      weekYear,
      leaves: groupedRecords[weekYear]
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
