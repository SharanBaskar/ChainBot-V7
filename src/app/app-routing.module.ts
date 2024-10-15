import { importProvidersFrom, NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { AdminComponent } from './admin/admin.component';
import { LeaveSummaryComponent } from './admin-leave-summary/leave-summary.component'; 
import { LeaveDetailsMonthWiseComponent } from './admin-leave-details-month-wise/leave-details-month-wise.component'; // New component
import { LeaveDetailsDateWiseComponent } from './admin-leave-details-date-wise/leave-details-date-wise.component'; // New component
import { EmployeeLeaveDetailsComponent } from './admin-employee-leave-details/employee-leave-details.component'; // New component
import { LeaveDetailsWeekWiseComponent } from './admin-leave-details-week-wise/leave-details-week-wise.component';
import {LeaveDetailsSummaryOfAllEmployeeComponent} from './admin-leave-details-summary-of-all-employee/leave-details-summary-of-all-employee.component';
import { MyDetailsComponent } from './home-my-details/my-details.component';
import { LeaveDetailsComponent } from './home-leave-details/leave-details.component';
import { LeaveReportComponent } from './home-leave-report/leave-report.component';
import { ServiceRequestsComponent } from './home-service-requests/service-requests.component';
import { DekstopSupportComponent } from './home-dekstop-support/dekstop-support.component';
import { AuthGuard } from './auth.guard'; // Import the guard

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminComponent}, // Apply guard
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },   // Apply guard
  { path: 'leave-summary', component: LeaveSummaryComponent },
  { path: 'leave-details-month-wise', component: LeaveDetailsMonthWiseComponent }, // New route
  { path: 'leave-details-date-wise', component: LeaveDetailsDateWiseComponent }, // New route
  { path: 'leave-details-week-wise', component: LeaveDetailsWeekWiseComponent},
  { path: 'employee-leave-details', component: EmployeeLeaveDetailsComponent }, // Route with parameter
  { path: 'leave-details-summary-of-all-employee', component: LeaveDetailsSummaryOfAllEmployeeComponent }, // Route with parameter
  { path: 'my-details', component: MyDetailsComponent }, // Route with parameter
  { path: 'leave-details', component: LeaveDetailsComponent }, // Route with parameter
  { path: 'leave-report', component: LeaveReportComponent }, // Route with parameter
  { path: 'service-requests', component: ServiceRequestsComponent }, // Route with parameter
  { path: 'dekstop-support', component: DekstopSupportComponent }, // Route with parameter
  { path: '', redirectTo: '/login', pathMatch: 'full' }, // Default route
  { path: '**', redirectTo: '/login' }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
