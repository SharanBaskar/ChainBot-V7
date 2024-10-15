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

import { CouchdbService } from '../couchdb.service'; // Adjust import path

@Component({
  selector: 'app-service-requests',
  templateUrl: './service-requests.component.html',
  styleUrls: ['./service-requests.component.css']
})
export class ServiceRequestsComponent implements OnInit, OnDestroy {
  serviceRequestIds: string[] = [];
  employee: any = null;
  leaveDetails: any = null;
  employeeId: string = ''; // Initialize as empty or null
  private changesSubscription: EventSource | undefined;
  private url = 'https://192.168.57.185:5984/employee-db/_changes?feed=continuous&include_docs=true';
  isLeaveReportOpen: boolean = false; // Control the dropdown visibility
  selectedServiceRequest: any = null; // Holds the details of the clicked SR
  serviceRequestDetails: { [key: string]: any } = {}; // Cache to store fetched SR details
  expandedServiceRequestId: string | null = null; // To track the currently expanded SR
  noDocumentsMessage: string | null = null; // New property to hold no document messages

  constructor(
    private http: HttpClient,
    private router: Router,
    private couchdbService: CouchdbService
  ) {}

  filter = {
    dateFrom: '',
    dateTo: '',
    monthFrom: '',
    monthTo: '',
    weekFrom: '',
    weekTo: ''
  };
  filtersVisible: boolean = false; // Track visibility of filters
  // Function to toggle filter visibility
  toggleFilters(): void {
    this.filtersVisible = !this.filtersVisible;
  }

  filteredServiceRequestIds: string[] = []; // This will hold the filtered service request IDs

  applyDateFilter(): void {
    const { dateFrom, dateTo } = this.filter;
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    this.filteredServiceRequestIds = this.serviceRequestIds.filter(id => {
      const requestDate = new Date(this.serviceRequestDetails[id]?.date);
      return requestDate >= fromDate && requestDate <= toDate;
    });

    // Update noDocumentsMessage based on filter results
    if (this.filteredServiceRequestIds.length === 0) {
      this.noDocumentsMessage = `There is no document available from the date ${this.getFormattedDate(dateFrom)} to ${this.getFormattedDate(dateTo)}`;
    } else {
      this.noDocumentsMessage = null; // Clear message if documents exist
    }
  }

  applyMonthFilter(): void {
    const { monthFrom, monthTo } = this.filter;

    const fromMonth = new Date(monthFrom);
    const toMonth = new Date(monthTo);
    toMonth.setMonth(toMonth.getMonth() + 1); // Include the entire end month

    this.filteredServiceRequestIds = this.serviceRequestIds.filter(id => {
      const requestDate = new Date(this.serviceRequestDetails[id]?.date);
      return requestDate >= fromMonth && requestDate < toMonth;
    });

    // Update noDocumentsMessage based on filter results
    if (this.filteredServiceRequestIds.length === 0) {
      this.noDocumentsMessage = `There is no document available from the month ${fromMonth.toLocaleString('default', { month: 'long' })} ${fromMonth.getFullYear()} to ${toMonth.toLocaleString('default', { month: 'long' })} ${toMonth.getFullYear()}`;
    } else {
      this.noDocumentsMessage = null; // Clear message if documents exist
    }
  }

  applyWeekFilter(): void {
    const { weekFrom, weekTo } = this.filter;
    const fromDate = new Date(weekFrom);
    const toDate = new Date(weekTo);

    this.filteredServiceRequestIds = this.serviceRequestIds.filter(id => {
      const requestDate = new Date(this.serviceRequestDetails[id]?.date);
      return requestDate >= fromDate && requestDate <= toDate;
    });

    // Update noDocumentsMessage based on filter results
    if (this.filteredServiceRequestIds.length === 0) {
      this.noDocumentsMessage = `There is no document available from the date ${this.getFormattedDate(weekFrom)} to ${this.getFormattedDate(weekTo)}`;
    } else {
      this.noDocumentsMessage = null; // Clear message if documents exist
    }
  }

  resetFilters(): void {
    this.filter = {
      dateFrom: '',
      dateTo: '',
      monthFrom: '',
      monthTo: '',
      weekFrom: '',
      weekTo: ''
    };
    this.filteredServiceRequestIds = [...this.serviceRequestIds]; // Reset to show all
    this.noDocumentsMessage = null; // Clear any previous messages
  }

  ngOnInit(): void {
    this.employeeId = sessionStorage.getItem('employeeId') || ''; // Retrieve the employee ID from sessionStorage
    if (this.employeeId) {
      this.fetchServiceRequests(); // Fetch all service requests for the employee
    } else {
      console.error('No employee ID found in session storage.');
    }

    this.fetchEmployeeDetails(); // Fetch employee data when the component loads
    this.listenForChanges(); // Start listening for CouchDB changes

    // Initially set the filteredServiceRequestIds to all serviceRequestIds
    this.filteredServiceRequestIds = [...this.serviceRequestIds];
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
    this.isLeaveReportOpen = !this.isLeaveReportOpen; // Toggle the dropdown
  }

  showServiceRequests(): void {
    this.router.navigate(['/service-requests']); // Define the route for service requests
  }

  showDekstopSupport(): void {
    this.router.navigate(['/dekstop-support']); // Define the route for service requests
  }
  
  showLeaveSummary(): void {
    this.router.navigate(['/leave-report']);
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
        (employeeResponse) => {
          if (employeeResponse && employeeResponse.data) {
            this.employee = employeeResponse.data;

            // Fetch leave records
            this.http.get<{ rows: LeaveDocument[] }>(leaveUrl, { headers }).subscribe(
              (leaveResponse) => {
                if (leaveResponse && leaveResponse.rows) {
                  this.leaveDetails = {
                    leaveBalance: 0, // Initialize as needed
                    casualLeaveBalance: 0,
                    medicalLeaveBalance: 0,
                    Leaves: leaveResponse.rows.map(row => row.value)
                  };
                } else {
                  console.error('No leave data found in the response.');
                }
              },
              (error) => {
                console.error('Error fetching leave data:', error);
              }
            );
          } else {
            console.error('No employee data found in the response.');
          }
        },
        (error) => {
          console.error('Error fetching employee data:', error);
        }
      );
    } else {
      console.error('No employee ID found in session storage.');
    }
  }

  getFormattedDate(isoDate: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`; // Format as dd/mm/yyyy
  }
  

// Method to toggle the service request details when clicked
toggleServiceRequestDetails(id: string): void {
  if (this.expandedServiceRequestId === id) {
    // If the request is already expanded, collapse it
    this.expandedServiceRequestId = null;
  } else {
    // Otherwise, expand the clicked request
    this.expandedServiceRequestId = id;
    this.loadServiceRequestDetails(id); // Load the details for the clicked request
  }
}

loadServiceRequestDetails(id: string): void {
  if (this.serviceRequestDetails[id]) {
    // If details are already cached, do nothing
    return;
  }

  const url = `https://192.168.57.185:5984/employee-db/${id}`;
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
  });

  this.http.get<any>(url, { headers }).subscribe(
    (response) => {
      this.serviceRequestDetails[id] = response; // Cache the fetched details
      // Ensure the date is initialized here
      if (!this.serviceRequestDetails[id]?.date) {
        this.serviceRequestDetails[id].date = response.date || ''; // Initialize the date
      }
    },
    (error) => {
      console.error('Error fetching service request details:', error);
    }
  );
}


// Fetch service requests logic remains the same
fetchServiceRequests(): void {
  if (!this.employeeId) return;
  this.couchdbService.getServiceRequestsByEmployee(this.employeeId).subscribe(
      (ids) => {
          this.serviceRequestIds = ids;

          // Fetch details for each service request ID
          ids.forEach(id => {
              this.loadServiceRequestDetails(id); // Load each request's details
          });

          // After fetching all requests, set the filtered list to all
          this.filteredServiceRequestIds = [...this.serviceRequestIds];
      },
      (error) => {
          console.error('Error fetching service requests:', error);
      }
  );
}

  listenForChanges(): void {
    // Use EventSource for continuous updates
    this.changesSubscription = new EventSource(this.url);
    this.changesSubscription.onmessage = (event) => {
      // Handle the incoming changes
      this.fetchServiceRequests();
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
