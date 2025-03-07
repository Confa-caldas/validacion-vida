import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveCheckComponent } from './live-check.component';

describe('LiveCheckComponent', () => {
  let component: LiveCheckComponent;
  let fixture: ComponentFixture<LiveCheckComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveCheckComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiveCheckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
