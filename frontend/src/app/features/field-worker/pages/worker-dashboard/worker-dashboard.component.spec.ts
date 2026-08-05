import { describe, it, expect, vi } from 'vitest';
import { runInInjectionContext } from '@angular/core';
import { WorkerDashboardComponent } from './worker-dashboard.component';
import { FieldWorkerService } from '../../../../core/services/field-worker.service';
import { of } from 'rxjs';

describe('WorkerDashboardComponent', () => {
  const createComponent = () => {
    const mockFieldWorkerService = {
      getAssignedJobs: vi.fn().mockReturnValue(
        of({
          success: true,
          data: {
            jobs: [
              {
                _id: 'job1',
                title: 'Fix Pothole',
                description: 'Large hole on main st',
                category: 'Road Damage',
                status: 'assigned',
                location: { latitude: 12.97, longitude: 77.59, address: 'Main St' },
                aiAnalysis: { priority: 'high' },
              },
            ],
            total: 1,
          },
        })
      ),
      updateJobStatus: vi.fn().mockReturnValue(
        of({
          success: true,
          data: {
            job: {
              _id: 'job1',
              title: 'Fix Pothole',
              status: 'in_progress',
            },
          },
        })
      ),
    };

    const mockInjector: any = {
      get: (token: any) => {
        if (token === FieldWorkerService) return mockFieldWorkerService;
        return null;
      },
    };

    let component!: WorkerDashboardComponent;
    runInInjectionContext(mockInjector, () => {
      component = new WorkerDashboardComponent();
    });

    return { component, mockFieldWorkerService };
  };

  it('should load jobs on init', () => {
    const { component } = createComponent();
    component.ngOnInit();
    expect(component.jobs()).toHaveLength(1);
    expect(component.selectedJob()?._id).toBe('job1');
    expect(component.loading()).toBe(false);
  });

  it('should select and clear job selection', () => {
    const { component } = createComponent();
    const mockJob: any = { _id: 'job2', title: 'Water Leak' };
    component.selectJob(mockJob);
    expect(component.selectedJob()?._id).toBe('job2');

    component.clearSelection();
    expect(component.selectedJob()).toBeNull();
  });

  it('should generate navigation link', () => {
    const { component } = createComponent();
    const link = component.getNavigationLink(12.971598, 77.594562);
    expect(link).toContain('https://www.google.com/maps/search/?api=1&query=12.971598,77.594562');
  });

  it('should update job status', () => {
    const { component, mockFieldWorkerService } = createComponent();
    component.selectedJob.set({ _id: 'job1' } as any);
    component.updateStatus('in_progress');
    expect(mockFieldWorkerService.updateJobStatus).toHaveBeenCalledWith(
      'job1',
      'in_progress',
      'Field Responder initialized status: in_progress'
    );
  });

  it('should prompt and submit resolution', () => {
    const { component, mockFieldWorkerService } = createComponent();
    component.selectedJob.set({ _id: 'job1' } as any);
    component.resolveJobPrompt();
    expect(component.showResolutionForm()).toBe(true);

    component.completionNotes = 'Completed repair';
    component.submitResolution();
    expect(mockFieldWorkerService.updateJobStatus).toHaveBeenCalledWith(
      'job1',
      'resolved',
      'Completed repair'
    );
  });

  it('should refresh GPS coordinates', () => {
    vi.useFakeTimers();
    const { component } = createComponent();
    component.refreshGPS();
    expect(component.refreshingGps()).toBe(true);

    vi.advanceTimersByTime(1300);
    expect(component.refreshingGps()).toBe(false);
    expect(component.mockLat).toBeDefined();
    vi.useRealTimers();
  });
});
