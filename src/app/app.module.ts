import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module'; // Import AppRoutingModule

import { AppComponent } from './app.component';
import { ChatbotComponent } from './chatbot/chatbot.component';
import { CouchdbService } from './couchdb.service';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { AdminComponent } from './admin/admin.component';
import { NgChartsModule } from 'ng2-charts';
import { LeaveSummaryComponent } from './admin-leave-summary/leave-summary.component';
import { LeaveDetailsMonthWiseComponent } from './admin-leave-details-month-wise/leave-details-month-wise.component';
import { LeaveDetailsDateWiseComponent } from './admin-leave-details-date-wise/leave-details-date-wise.component';
import { EmployeeLeaveDetailsComponent } from './admin-employee-leave-details/employee-leave-details.component';
import { LeaveDetailsWeekWiseComponent } from './admin-leave-details-week-wise/leave-details-week-wise.component';
import { LeaveDetailsSummaryOfAllEmployeeComponent } from './admin-leave-details-summary-of-all-employee/leave-details-summary-of-all-employee.component';
import { MyDetailsComponent } from './home-my-details/my-details.component';
import { LeaveDetailsComponent } from './home-leave-details/leave-details.component';
import { LeaveReportComponent } from './home-leave-report/leave-report.component';
import { ServiceRequestsComponent } from './home-service-requests/service-requests.component';
import { DekstopSupportComponent } from './home-dekstop-support/dekstop-support.component';


@NgModule({
  declarations: [
    AppComponent,
    ChatbotComponent,
    HomeComponent,
    LoginComponent,
    AdminComponent,
    LeaveSummaryComponent,
    LeaveDetailsMonthWiseComponent,
    LeaveDetailsDateWiseComponent,
    EmployeeLeaveDetailsComponent,
    LeaveDetailsWeekWiseComponent,
    LeaveDetailsSummaryOfAllEmployeeComponent,
    MyDetailsComponent,
    LeaveDetailsComponent,
    LeaveReportComponent,
    ServiceRequestsComponent,
    DekstopSupportComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    NgChartsModule // Add ChartsModule here
    // Add AppRoutingModule to imports
  ],
  providers: [CouchdbService],
  bootstrap: [AppComponent]
})
export class AppModule { }
