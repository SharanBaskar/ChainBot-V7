import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DekstopSupportComponent } from './dekstop-support.component';

describe('DekstopSupportComponent', () => {
  let component: DekstopSupportComponent;
  let fixture: ComponentFixture<DekstopSupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DekstopSupportComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DekstopSupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
