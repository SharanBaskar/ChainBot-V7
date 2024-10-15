import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CouchdbService } from '../couchdb.service'; // Update the import path as necessary

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  errorMessage: string = '';

  constructor(private router: Router, private couchdbService: CouchdbService) {}

  onSubmit(): void {
    // Check if the credentials are for the admin
    if (this.username === 'admin' && this.password === 'chainsys') {
      this.router.navigate(['/admin']);
      console.log('Navigating to admin');

      return;
    }

    // Otherwise, authenticate user through the CouchDB service
    this.couchdbService.authenticate(this.username, this.password).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        sessionStorage.setItem('employeeId', this.username);
        this.router.navigate(['/home']);
      } else {
        this.errorMessage = 'Invalid username or password';
      }
    });
  }
}
