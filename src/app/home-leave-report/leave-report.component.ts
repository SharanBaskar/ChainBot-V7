import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Define an interface for the leave document
interface LeaveDocument {
  id: string;
  key: string;
  value: {
    _id: string;
    _rev: string;
    type: string;
    employee: string;
    leaveType: string;
    leaveReason: string;
    startDate: string;
    endDate: string;
    leaveDays: string;
    lossOfPay: string;
    date: string;
  };
}

@Component({
  selector: 'app-leave-report',
  templateUrl: './leave-report.component.html',
  styleUrls: ['./leave-report.component.css']
})
export class LeaveReportComponent implements OnInit, OnDestroy {
  employee: any = null;
  leaveDetails: any = null;
  private changesSubscription: EventSource | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=continuous&include_docs=true';
  isLeaveReportOpen: boolean = false; // Control the dropdown visibility

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchEmployeeDetails();
    this.listenForChanges();
  }
  isLeaveMenuOpen: boolean = false;

  toggleLeaveMenu() {
    this.isLeaveMenuOpen = !this.isLeaveMenuOpen;
  }
  
  showMyDetails(): void {
    this.router.navigate(['/my-details']);
  }

  showLeaveDetails(): void {
    this.router.navigate(['/leave-details']);
  }

  showLeaveSummary(): void {
    this.router.navigate(['/leave-report']);
  }

  showServiceRequests(): void {
    this.router.navigate(['/service-requests']); // Define the route for service requests
  }
  
  showDekstopSupport(): void {
    this.router.navigate(['/dekstop-support']); // Define the route for service requests
  }

  home(): void {
    this.router.navigate(['/home']);
  }
  
  logout(): void {
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }

  fetchEmployeeDetails(): void {
    const employeeId = sessionStorage.getItem('employeeId');
    if (employeeId) {
      const employeeUrl = `https://192.168.57.185:5984/employee-db/employee_2_${employeeId}`;
      const leaveUrl = `https://192.168.57.185:5984/employee-db/_design/leave/_view/by_employee?key="${employeeId}"`;
      const headers = new HttpHeaders({
        'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
      });
  
      // Fetch employee details
      this.http.get<any>(employeeUrl, { headers }).subscribe(
        employeeResponse => {
          if (employeeResponse && employeeResponse.data) {
            this.employee = employeeResponse.data;
  
            // Fetch leave records
            this.http.get<{ rows: LeaveDocument[] }>(leaveUrl, { headers }).subscribe(
              leaveResponse => {
                if (leaveResponse && leaveResponse.rows) {
                  this.leaveDetails = {
                    leaveBalance: 0, // Initialize as needed
                    casualLeaveBalance: 0,
                    medicalLeaveBalance: 0,
                    Leaves: leaveResponse.rows.map(row => row.value)
                  };
                  this.calculateLeaveBalances();
                  this.sortLeaveRecords();
                  this.generateYearOptions(); // Call after fetching data
                } else {
                  console.error('No leave data found in the response.');
                }
              },
              error => {
                console.error('Error fetching leave data:', error);
              }
            );
          } else {
            console.error('No employee data found in the response.');
          }
        },
        error => {
          console.error('Error fetching employee data:', error);
        }
      );
    } else {
      console.error('No employee ID found in session storage.');
    }
  }
  
  calculateLeaveBalances(): void {
    if (this.leaveDetails && this.leaveDetails.Leaves) {
      let totalLeaveBalance = 0;
      let casualLeaveBalance = 0;
      let medicalLeaveBalance = 0;

      this.leaveDetails.Leaves.forEach((leave: any) => {
        const leaveDays = parseInt(leave.leaveDays, 10) || 0;
        totalLeaveBalance += leaveDays;

        if (leave.leaveType.toLowerCase() === 'casual leave') {
          casualLeaveBalance += leaveDays;
        } else if (leave.leaveType.toLowerCase() === 'medical leave') {
          medicalLeaveBalance += leaveDays;
        }
      });

      this.leaveDetails.leaveBalance = totalLeaveBalance;
      this.leaveDetails.casualLeaveBalance = casualLeaveBalance;
      this.leaveDetails.medicalLeaveBalance = medicalLeaveBalance;
    }
  }

  sortLeaveRecords(): void {
    if (this.leaveDetails && this.leaveDetails.Leaves) {
      this.leaveDetails.Leaves.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }
  }

  yearOptions: string[] = []; // Ensure this is a string array

  // When creating the yearOptions array
  generateYearOptions(): void {
    if (this.leaveDetails && this.leaveDetails.Leaves) {
      const years = new Set<string>(
        this.leaveDetails.Leaves.map((leave: any) => new Date(leave.startDate).getFullYear().toString())
      );
      this.yearOptions = Array.from(years).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    }
  }
  
  
  groupLeaveRecordsByYear(): { year: string; leaves: any[] }[] {
    const groupedRecords: { [key: string]: any[] } = {};

    if (this.leaveDetails && this.leaveDetails.Leaves) {
      this.leaveDetails.Leaves.forEach((leave: any) => {
        const startDate = new Date(leave.startDate);
        const year = startDate.getFullYear().toString();

        if (!groupedRecords[year]) {
          groupedRecords[year] = [];
        }
        groupedRecords[year].push(leave);
      });
    }

    const yearArray = Object.keys(groupedRecords).map(year => ({
      year,
      leaves: groupedRecords[year]
    }));

    yearArray.sort((a, b) => parseInt(b.year, 10) - parseInt(a.year, 10));

    // Filter by selected year
    if (this.selectedYear !== 'all') {
      return yearArray.filter(group => group.year === this.selectedYear);
    }

    return yearArray;
  }
  selectedYear: string = 'all'; // Filter option for years

  fetchLeaveRecordsByYear(): void {
    this.groupedLeaveRecords = this.groupLeaveRecordsByYear();
  }

  groupedLeaveRecords: { year: string; leaves: any[] }[] = []; // Define this property

 listenForChanges(): void {
    // Use EventSource for continuous updates
    this.changesSubscription = new EventSource(this.url);
    this.changesSubscription.onmessage = (event) => {
      // Handle the incoming changes
      this.fetchEmployeeDetails(); // Re-fetch data as needed
    };
    this.changesSubscription.onerror = (error) => {
      console.error('EventSource error:', error);
    };
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
    });
  }

  ngOnDestroy(): void {
    // Close the EventSource connection when the component is destroyed
    if (this.changesSubscription) {
      this.changesSubscription.close();
    }
  }
}


