import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaveDetailsWeekWiseComponent } from './leave-details-week-wise.component';

describe('LeaveDetailsWeekWiseComponent', () => {
  let component: LeaveDetailsWeekWiseComponent;
  let fixture: ComponentFixture<LeaveDetailsWeekWiseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeaveDetailsWeekWiseComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaveDetailsWeekWiseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
