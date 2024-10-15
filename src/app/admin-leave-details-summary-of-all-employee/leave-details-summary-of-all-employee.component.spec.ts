import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaveDetailsSummaryOfAllEmployeeComponent } from './leave-details-summary-of-all-employee.component';

describe('LeaveDetailsSummaryOfAllEmployeeComponent', () => {
  let component: LeaveDetailsSummaryOfAllEmployeeComponent;
  let fixture: ComponentFixture<LeaveDetailsSummaryOfAllEmployeeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeaveDetailsSummaryOfAllEmployeeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaveDetailsSummaryOfAllEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
