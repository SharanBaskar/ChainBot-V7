import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaveDetailsDateWiseComponent } from './leave-details-date-wise.component';

describe('LeaveDetailsDateWiseComponent', () => {
  let component: LeaveDetailsDateWiseComponent;
  let fixture: ComponentFixture<LeaveDetailsDateWiseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeaveDetailsDateWiseComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaveDetailsDateWiseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
