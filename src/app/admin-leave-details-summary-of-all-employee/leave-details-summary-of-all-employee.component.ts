import { Component, OnInit, OnDestroy } from '@angular/core';
import { CouchdbService } from '../couchdb.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
interface LeaveRecord {
  employeeId: string;
  employeename: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  leaveReason: string;
  leaveDays: number;
  lossOfPay: string;
  casualLeaveBalance: number;
  medicalLeaveBalance: number;
  totalLeaveBalance: number;
}
@Component({
  selector: 'app-leave-details-summary-of-all-employee',
  templateUrl: './leave-details-summary-of-all-employee.component.html',
  styleUrls: ['./leave-details-summary-of-all-employee.component.css']
})
export class LeaveDetailsSummaryOfAllEmployeeComponent implements OnInit, OnDestroy {
  allEmployeeLeaves: any[] = [];
  employeeDetails: any[] = [];
  groupedLeaveRecords: any[] = [];
  employeeLeaveSummary: any[] = [];
  leaveRecordsToday: any[] = []; // Added property to store today's leave records
  private changesSubscription: Subscription | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=longpoll&include_docs=true';
  private pollingInterval = 1000; // Poll every 1 second
  showMenu = false;
  public leaveCounts = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    thisYear: 0
  };
    
  constructor(
    private couchdbService: CouchdbService, 
    private router: Router,    
    private http: HttpClient,
  ) {}
  navigateTo(page: string) {
    if (page === 'week-wise') {
      this.router.navigate(['/leave-details-week-wise']);
    } else if (page === 'month-wise') {
      this.router.navigate(['/leave-details-month-wise']);
    } else if (page === 'year-wise') {
      this.router.navigate(['/leave-details-year-wise']);
    } else if (page === 'date-wise') {
      this.router.navigate(['/leave-details-date-wise']);
    }
  }
  toggleMenu(): void {
    this.showMenu = !this.showMenu;
  }

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
    this.router.navigate(['/admin']);
  }

  showLeaveRecordsForToday(): void {
    const today = new Date();
    // Set time components to zero for accurate comparison
    today.setHours(0, 0, 0, 0);
    
    this.leaveRecordsToday = this.groupedLeaveRecords.flatMap(group =>
      group.leaves.filter((leave: LeaveRecord) => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
  
        // Set time components to zero for accurate comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
          return today >= startDate && today <= endDate;
      })
    );
    }

    getUniqueEmployeeCount(leaveRecords: LeaveRecord[]): number {
      const uniqueEmployeeIds = new Set(
        leaveRecords.map((record: LeaveRecord) => record.employeeId)
      );
      return uniqueEmployeeIds.size;
    }
    getLeaveSummary(): void {
      this.showLeaveRecordsForToday();
    }

    calculateLeaveCounts(): void {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
    
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
    
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
    
      const uniqueEmployeesToday = new Set<string>();
      const uniqueEmployeesWeek = new Set<string>();
      const uniqueEmployeesMonth = new Set<string>();
      const uniqueEmployeesYear = new Set<string>();
    
      this.groupedLeaveRecords.forEach(group => {
        group.leaves.forEach((leave: LeaveRecord) => {
          const leaveStartDate = new Date(leave.startDate);
          const leaveEndDate = new Date(leave.endDate);
          
          // Check if leave overlaps with today
          if (today >= leaveStartDate && today <= leaveEndDate) {
            uniqueEmployeesToday.add(leave.employeeId);
          }
          
          // Check if leave overlaps with this week
          if (leaveEndDate >= startOfWeek && leaveStartDate <= endOfWeek) {
            uniqueEmployeesWeek.add(leave.employeeId);
          }
          
          // Check if leave overlaps with this month
          if (leaveEndDate >= startOfMonth && leaveStartDate <= endOfMonth) {
            uniqueEmployeesMonth.add(leave.employeeId);
          }
          
          // Check if leave overlaps with this year
          if (leaveEndDate >= startOfYear && leaveStartDate <= endOfYear) {
            uniqueEmployeesYear.add(leave.employeeId);
          }
        });
      });
        this.leaveCounts.thisWeek = uniqueEmployeesWeek.size;
      this.leaveCounts.thisMonth = uniqueEmployeesMonth.size;
      this.leaveCounts.thisYear = uniqueEmployeesYear.size;
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
            this.showLeaveRecordsForToday(); // Filter and set today's leave records
            this.calculateLeaveCounts(); // Calculate the leave counts

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
        this.groupedLeaveRecords = this.groupLeaveRecordsByMonth(leaveRecordsWithBalances);
        this.employeeLeaveSummary = this.calculateEmployeeLeaveSummary(leaveRecordsWithBalances);
    } else {
        console.error('No leave records or employee details available to match.');
    }
  }

  groupLeaveRecordsByMonth(records: any[]): any[] {
    const groupedRecords: { [key: string]: any[] } = {};
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December'
    ];
    records.forEach((record: any) => {
      if (record.startDate) {
        const startDate = new Date(record.startDate);
        const month = monthNames[startDate.getMonth()];
        const year = startDate.getFullYear();
        const monthYear = `${month} ${year}`;
        if (!groupedRecords[monthYear]) {
          groupedRecords[monthYear] = [];
        }
        groupedRecords[monthYear].push(record);
      }
    });
    return Object.keys(groupedRecords).map(monthYear => ({
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
