import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaveDetailsMonthWiseComponent } from './leave-details-month-wise.component';

describe('LeaveDetailsMonthWiseComponent', () => {
  let component: LeaveDetailsMonthWiseComponent;
  let fixture: ComponentFixture<LeaveDetailsMonthWiseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeaveDetailsMonthWiseComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaveDetailsMonthWiseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
