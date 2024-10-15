import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface User {
  username: string;
  password: string;
}
interface DecisionTree {
  startNode: string;
  nodes: { [key: string]: Node };
}

interface Node {
  type: string;
  text: string;
  answers?: Answer[];
  next?: string;
}
interface UsersResponse {
  users: User[];
}
interface Answer {
  text: string;
  next: string;
}
interface KeywordMappings {
  [key: string]: string;
}

@Injectable({
  providedIn: 'root'
})
export class CouchdbService {
  private dbUrl = 'https://192.168.57.185:5984/decison-tree-db/decisiontree_12';
  private DBUrl = 'https://192.168.57.185:5984/decison-tree-db/users';
  private username = 'd_couchdb'; // Replace with your CouchDB username
  private password = 'Welcome#2'; // Replace with your CouchDB password

  constructor(private http: HttpClient) { }

  getDecisionTree(): Observable<{ data: DecisionTree }> {
    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
    });

    return this.http.get<{ data: DecisionTree }>(this.dbUrl, { headers });
  }

  getUsers(): Observable<UsersResponse> {
    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
    });

    return this.http.get<UsersResponse>(this.DBUrl, { headers });
  }

  authenticate(username: string, password: string): Observable<boolean> {
    return this.getUsers().pipe(
      catchError(() => of({ users: [] })), // Handle errors gracefully
      map((response: UsersResponse) => {
        if (!response || !response.users) {
          return false; // Return false if response is invalid
        }
        const user = response.users.find(user => user.username === username);
        return user ? user.password === password : false; // Validate credentials
      })
    );
  }

getEmployeeDetails(): Observable<any[]> {
    const headers = new HttpHeaders({
        'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
    });

    const url = 'https://192.168.57.185:5984/employee-db/_all_docs?include_docs=true';

    return this.http.get<any>(url, { headers }).pipe(
        map(response => {
            return response.rows
                .filter((row: { doc?: { data?: { type: string } } }) => row.doc?.data?.type === 'employee')
                .map((row: { doc?: { data: any } }) => row.doc?.data || {});
        }),
        catchError(error => {
            console.error('Error fetching employee details:', error);
            return of([]);
        })
    );
}

getEmployeeLeaves(employeeId: string): Observable<any[]> {
    const headers = new HttpHeaders({
        'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
    });

    const url = `https://192.168.57.185:5984/employee-db/_design/leave/_view/by_employee?key="${employeeId}"`;

    return this.http.get<any>(url, { headers }).pipe(
        map(response => {
            return response.rows.map((row: { value: any }) => row.value);
        }),
        catchError(error => {
            console.error('Error fetching leave records:', error);
            return of([]);
        })
    );
}

getLeaveBalance(employeeId: string): Observable<any> {
  const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
  });

  const url = `https://192.168.57.185:5984/employee-db/leave_2_${employeeId}`;

  return this.http.get<any>(url, { headers }).pipe(
      map(response => {
          return response.data || {};  // Assuming the relevant data is inside a `data` field
      }),
      catchError(error => {
          console.error('Error fetching leave balance:', error);
          return of({});
      })
  );
}

checkEmployeeExists(employeeId: string): Observable<boolean> {
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
  });

  // Make sure to format the employeeId correctly in the URL
  const url = `https://192.168.57.185:5984/employee-db/_design/employee/_view/by_employee_id?key="${employeeId}"`;

  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      console.log('Response from CouchDB:', response); // Log the response to debug
      return response.rows.length > 0; // Check if any rows are returned
    }),
    catchError(error => {
      console.error('Error checking employee existence:', error);
      return of(false); // Return false if there's an error
    })
  );
}

getServiceRequestsByEmployee(employeeId: string): Observable<string[]> {
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
  });

  const url = `https://192.168.57.185:5984/employee-db/_design/service_request/_view/by_employee?key="${employeeId}"`;

  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      // Map the response to extract document IDs
      return response.rows.map((row: { id: string }) => row.id);
    }),
    catchError(error => {
      console.error('Error fetching service requests:', error);
      return of([]);
    })
  );
}

}
