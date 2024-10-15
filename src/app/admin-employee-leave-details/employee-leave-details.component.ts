import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

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
  selector: 'app-employee-leave-details',
  templateUrl: './employee-leave-details.component.html',
  styleUrls: ['./employee-leave-details.component.css']
})
export class EmployeeLeaveDetailsComponent implements OnInit, OnDestroy {
  employee: any = null;
  leaveDetails: any = null;
  employeeId: string = ''; // Store employee ID from the input field
  private changesSubscription: Subscription | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=longpoll&include_docs=true';
  private pollingInterval = 1000; // Poll every 1 second

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Optionally initialize with a default or stored employee ID
    // this.fetchEmployeeDetails('defaultEmployeeId');
  }
  errorMessage: string = ''; // Variable to store error message
  fetchEmployeeDetails(employeeId: string): void {
    if (employeeId) {
      const employeeUrl = `https://192.168.57.185:5984/employee-db/employee_2_${employeeId}`;
      const leaveUrl = `https://192.168.57.185:5984/employee-db/_design/leave/_view/by_employee?key="${employeeId}"`;
      const headers = new HttpHeaders({
        'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
      });

      // Reset error message and existing data
      this.errorMessage = '';
      this.employee = null;
      this.leaveDetails = null;

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
                    leaveBalance: 0,
                    casualLeaveBalance: 0,
                    medicalLeaveBalance: 0,
                    Leaves: leaveResponse.rows.map(row => row.value)
                  };
                  this.calculateLeaveBalances();
                  this.sortLeaveRecords();
                } else {
                  console.error('No leave data found in the response.');
                }
              },
              error => {
                console.error('Error fetching leave data:', error);
              }
            );
          } else {
            // Set error message when employee doesn't exist
            this.errorMessage = 'No employee found with the provided ID.';
          }
        },
        error => {
          console.error('Error fetching employee data:', error);
          // Set error message on HTTP failure
          this.errorMessage = 'Error fetching employee data. Please check the employee ID.';
        }
      );
    } else {
      this.errorMessage = 'Please enter a valid employee ID.';
    }
  }

  onSearch(): void {
    this.fetchEmployeeDetails(this.employeeId); // Fetch details based on the input ID
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

  ngOnDestroy(): void {
    // Unsubscribe from the polling subscription when the component is destroyed
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
  }

  showLeaveSummary(): void {
    this.router.navigate(['/leave-summary']);
  }

  home(): void {
    this.router.navigate(['/admin']);
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
  logout(): void {
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
  
}
