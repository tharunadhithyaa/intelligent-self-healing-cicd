import { Component, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ComplaintsService } from '../../../../core/services/complaints.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { COMPLAINT_CATEGORIES, AIAnalysis } from '../../../../core/models/complaint.model';
import { ROUTE_PATHS } from '../../../../core/constants/route.constants';

interface UploadedImage {
  base64Data: string;
  contentType: string;
  fileName: string;
}

@Component({
  selector: 'app-complaint-submit',
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    DatePipe,
    UpperCasePipe,
  ],
  template: `
    <div class="submit-page animate-fade-in-up">
      <app-page-header
        title="Report New Incident"
        subtitle="Submit details of a community issue. Our AI assistant will automatically classify and assign it."
        icon="campaign"
      />

      <!-- Custom Wizard Stepper -->
      <div class="stepper">
        <div class="stepper__header">
          @for (step of steps; track step.num) {
            <div
              class="stepper__step"
              [class.stepper__step--active]="currentStep() === step.num"
              [class.stepper__step--completed]="currentStep() > step.num"
            >
              <div class="stepper__circle">
                @if (currentStep() > step.num) {
                  <mat-icon>check</mat-icon>
                } @else {
                  <span>{{ step.num }}</span>
                }
              </div>
              <span class="stepper__label">{{ step.label }}</span>
              @if (step.num < 4) {
                <div class="stepper__connector"></div>
              }
            </div>
          }
        </div>

        <div class="stepper__content">
          <!-- STEP 1: COMPLAINT INFORMATION -->
          @if (currentStep() === 1) {
            <form [formGroup]="infoForm" class="form-step animate-fade-in-up">
              <h3 class="form-step__title">Provide Issue Details</h3>
              <p class="form-step__subtitle">Fill in general location and description details.</p>

              <div class="form-grid">
                <mat-form-field appearance="outline" class="col-12">
                  <mat-label>Complaint Title</mat-label>
                  <input
                    matInput
                    formControlName="title"
                    placeholder="Briefly summarize the issue (e.g. Large pothole near Main Street)"
                  />
                  <mat-icon matPrefix>edit</mat-icon>
                  @if (
                    infoForm.get('title')?.hasError('required') && infoForm.get('title')?.touched
                  ) {
                    <mat-error>Title is required</mat-error>
                  }
                  @if (
                    infoForm.get('title')?.hasError('minlength') && infoForm.get('title')?.touched
                  ) {
                    <mat-error>Title must be at least 5 characters</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline" class="col-12">
                  <mat-label>Detailed Description</mat-label>
                  <textarea
                    matInput
                    formControlName="description"
                    rows="4"
                    placeholder="Explain the problem in detail so officers can address it..."
                  ></textarea>
                  <mat-icon matPrefix>description</mat-icon>
                  @if (
                    infoForm.get('description')?.hasError('required') &&
                    infoForm.get('description')?.touched
                  ) {
                    <mat-error>Description is required</mat-error>
                  }
                  @if (
                    infoForm.get('description')?.hasError('minlength') &&
                    infoForm.get('description')?.touched
                  ) {
                    <mat-error>Description must be at least 10 characters</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline" class="col-6">
                  <mat-label>Initial Category Choice</mat-label>
                  <mat-select formControlName="category">
                    @for (cat of categories; track cat) {
                      <mat-option [value]="cat">{{ cat }}</mat-option>
                    }
                  </mat-select>
                  <mat-icon matPrefix>category</mat-icon>
                  @if (
                    infoForm.get('category')?.hasError('required') &&
                    infoForm.get('category')?.touched
                  ) {
                    <mat-error>Category is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline" class="col-6">
                  <mat-label>Location Address</mat-label>
                  <input
                    matInput
                    formControlName="address"
                    placeholder="Street, landmark, neighborhood..."
                  />
                  <mat-icon matPrefix>location_on</mat-icon>
                  @if (
                    infoForm.get('address')?.hasError('required') &&
                    infoForm.get('address')?.touched
                  ) {
                    <mat-error>Address is required</mat-error>
                  }
                </mat-form-field>
              </div>

              <div class="form-step__actions">
                <button
                  mat-flat-button
                  color="primary"
                  (click)="goToStep2()"
                  [disabled]="infoForm.invalid"
                >
                  Analyze with AI <mat-icon matSuffix>psychology</mat-icon>
                </button>
              </div>
            </form>
          }

          <!-- STEP 2: AI ASSISTANCE -->
          @if (currentStep() === 2) {
            <div class="form-step animate-fade-in-up">
              <h3 class="form-step__title">AI Copilot Analysis</h3>
              <p class="form-step__subtitle">
                Our integrated AI has reviewed the complaint draft. You can confirm or modify the
                suggestions below.
              </p>

              @if (analyzing()) {
                <div class="loading-box">
                  <mat-progress-spinner mode="indeterminate" diameter="48"></mat-progress-spinner>
                  <p>Analyzing description patterns and scanning for duplicates...</p>
                </div>
              } @else if (aiAnalysis()) {
                <div class="ai-box">
                  <!-- Confidence score metric -->
                  <div class="ai-box__score">
                    <div class="radial-score">
                      <span class="value">{{ aiAnalysis()?.confidenceScore }}%</span>
                      <span class="label">AI Confidence</span>
                    </div>
                    <div class="ai-box__metrics">
                      <div class="ai-badge category">
                        <mat-icon>label</mat-icon> Classified Category:
                        <strong>{{ aiAnalysis()?.category }}</strong>
                      </div>
                      <div class="ai-badge priority" [class]="aiAnalysis()?.priority">
                        <mat-icon>priority_high</mat-icon> Predicted Priority:
                        <strong>{{ aiAnalysis()?.priority | uppercase }}</strong>
                      </div>
                    </div>
                  </div>

                  <!-- Duplicate Warning if detected -->
                  @if (aiAnalysis()?.duplicateDetected) {
                    <div class="ai-warning-card">
                      <mat-icon>warning</mat-icon>
                      <div class="content">
                        <h4>Potential Duplicate Detected</h4>
                        <p>{{ aiAnalysis()?.duplicateWarning }}</p>
                      </div>
                    </div>
                  } @else {
                    <div class="ai-success-card">
                      <mat-icon>check_circle</mat-icon>
                      <p>
                        Duplicate Check: No matching reports registered nearby in the last 72 hours.
                        This is a unique issue!
                      </p>
                    </div>
                  }

                  <!-- Department recommendation and summary -->
                  <div class="ai-card">
                    <mat-icon class="ai-card__icon">account_balance</mat-icon>
                    <div class="ai-card__body">
                      <h4>Recommended Responsible Department</h4>
                      <p>
                        <strong>{{ aiAnalysis()?.department }}</strong>
                      </p>
                    </div>
                  </div>

                  <div class="ai-card">
                    <mat-icon class="ai-card__icon">summarize</mat-icon>
                    <div class="ai-card__body">
                      <h4>AI Auto-Generated Summary for Officers</h4>
                      <p class="summary-text">
                        <em>"{{ aiAnalysis()?.summary }}"</em>
                      </p>
                    </div>
                  </div>

                  <!-- Override category form selection if needed -->
                  <div class="override-category">
                    <p>If you disagree with the AI category suggestion, choose a different one:</p>
                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>Adjust Category</mat-label>
                      <mat-select
                        [value]="confirmedCategory()"
                        (selectionChange)="updateConfirmedCategory($event.value)"
                      >
                        @for (cat of categories; track cat) {
                          <mat-option [value]="cat">{{ cat }}</mat-option>
                        }
                      </mat-select>
                      <mat-icon matPrefix>category</mat-icon>
                    </mat-form-field>
                  </div>
                </div>

                <div class="form-step__actions">
                  <button mat-stroked-button (click)="prevStep()">
                    <mat-icon>chevron_left</mat-icon> Edit Details
                  </button>
                  <button mat-flat-button color="primary" (click)="goToStep3()">
                    Accept & Continue <mat-icon matSuffix>chevron_right</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- STEP 3: IMAGE UPLOAD -->
          @if (currentStep() === 3) {
            <div class="form-step animate-fade-in-up">
              <h3 class="form-step__title">Attach Supporting Photos</h3>
              <p class="form-step__subtitle">
                Add visual context to help field officers locate and identify the issue. (Max 2MB
                per image, JPG/PNG formats supported).
              </p>

              <div class="upload-zone" (click)="fileInput.click()">
                <input
                  #fileInput
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/jpg"
                  style="display:none"
                  (change)="onFileSelected($event)"
                />
                <mat-icon class="upload-zone__icon">add_a_photo</mat-icon>
                <p class="upload-zone__title">Click to browse or drag images here</p>
                <span class="upload-zone__limits">Select up to 3 images</span>
              </div>

              @if (uploadedImages().length > 0) {
                <div class="image-gallery">
                  @for (img of uploadedImages(); track img.fileName; let idx = $index) {
                    <div class="image-tile">
                      <img [src]="img.base64Data" [alt]="img.fileName" />
                      <div class="image-tile__overlay">
                        <span class="filename">{{ img.fileName }}</span>
                        <button
                          class="remove-btn"
                          (click)="removeImage(idx)"
                          aria-label="Remove image"
                        >
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="form-step__actions">
                <button mat-stroked-button (click)="prevStep()">
                  <mat-icon>chevron_left</mat-icon> Back to AI Analysis
                </button>
                <button mat-flat-button color="primary" (click)="goToStep4()">
                  Proceed to Review <mat-icon matSuffix>chevron_right</mat-icon>
                </button>
              </div>
            </div>
          }

          <!-- STEP 4: REVIEW & SUBMIT -->
          @if (currentStep() === 4) {
            <div class="form-step animate-fade-in-up">
              <h3 class="form-step__title">Review Final Report</h3>
              <p class="form-step__subtitle">
                Please verify that all detailed information and coordinates are correct before
                finalizing submission.
              </p>

              <div class="review-box">
                <div class="review-box__section">
                  <h4>General Info</h4>
                  <p><strong>Title:</strong> {{ infoForm.get('title')?.value }}</p>
                  <p><strong>Description:</strong> {{ infoForm.get('description')?.value }}</p>
                  <p><strong>Report Date:</strong> {{ todayDate | date: 'mediumDate' }}</p>
                </div>

                <div class="review-box__section">
                  <h4>Location & Classification</h4>
                  <p><strong>Address:</strong> {{ infoForm.get('address')?.value }}</p>
                  <p><strong>Category:</strong> {{ confirmedCategory() }}</p>
                  <p><strong>Target Department:</strong> {{ aiAnalysis()?.department }}</p>
                  <p>
                    <strong>Priority Level:</strong>
                    <span class="priority-text" [class]="aiAnalysis()?.priority">{{
                      aiAnalysis()?.priority | uppercase
                    }}</span>
                  </p>
                </div>

                @if (uploadedImages().length > 0) {
                  <div class="review-box__section">
                    <h4>Attached Files ({{ uploadedImages().length }})</h4>
                    <div class="review-images">
                      @for (img of uploadedImages(); track img.fileName) {
                        <div class="thumb">
                          <img [src]="img.base64Data" [alt]="img.fileName" />
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="form-step__actions">
                <button mat-stroked-button (click)="prevStep()" [disabled]="submitting()">
                  <mat-icon>chevron_left</mat-icon> Edit Photos
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  (click)="submit()"
                  [disabled]="submitting()"
                >
                  @if (submitting()) {
                    <mat-progress-spinner
                      mode="indeterminate"
                      diameter="20"
                      style="display:inline-block; margin-right:6px"
                    ></mat-progress-spinner>
                    Submitting...
                  } @else {
                    <span
                      >Submit Complaint
                      <mat-icon
                        style="display: inline-block; vertical-align: middle; margin-left: 4px; font-size: 18px; width: 18px; height: 18px;"
                        >check_circle</mat-icon
                      ></span
                    >
                  }
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .submit-page {
        max-width: 800px;
        margin: 0 auto;
      }

      // ─── Stepper Progress Header ───
      .stepper {
        background: $surface;
        border-radius: $radius-xl;
        border: 1px solid $border;
        box-shadow: $shadow-card;
        overflow: hidden;
        margin-top: $spacing-6;

        &__header {
          display: flex;
          justify-content: space-between;
          padding: $spacing-6 $spacing-8;
          background: $background;
          border-bottom: 1px solid $border;

          @include mobile-only {
            padding: $spacing-4;
          }
        }

        &__step {
          display: flex;
          align-items: center;
          position: relative;
          flex: 1;

          &:last-child {
            flex: none;
          }
        }

        &__circle {
          @include flex-center;
          width: 32px;
          height: 32px;
          border-radius: $radius-full;
          background: $border;
          color: $text-secondary;
          font-weight: $font-weight-bold;
          font-size: $font-size-sm;
          z-index: 2;
          transition: all $transition-normal;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: $text-inverse;
          }
        }

        &__label {
          font-size: $font-size-xs;
          font-weight: $font-weight-semibold;
          color: $text-secondary;
          margin-left: $spacing-2;

          @include mobile-only {
            display: none; // Hide labels on small mobile screens
          }
        }

        &__connector {
          position: absolute;
          top: 16px;
          left: 32px;
          right: 16px;
          height: 2px;
          background: $border;
          z-index: 1;
          transition: all $transition-normal;
        }

        // Stepper States
        &__step--active &__circle {
          background: $primary;
          color: $text-inverse;
          box-shadow: 0 0 0 4px $primary-light;
        }
        &__step--active &__label {
          color: $primary-dark;
        }

        &__step--completed &__circle {
          background: $primary-hover;
          color: $text-inverse;
        }
        &__step--completed &__connector {
          background: $primary-hover;
        }

        &__content {
          padding: $spacing-6 $spacing-8;

          @include mobile-only {
            padding: $spacing-5 $spacing-4;
          }
        }
      }

      // ─── Forms and Steps ───
      .form-step {
        &__title {
          font-size: $font-size-lg;
          font-weight: $font-weight-bold;
          color: $text-primary;
          margin-bottom: $spacing-1;
        }

        &__subtitle {
          font-size: $font-size-sm;
          color: $text-secondary;
          margin-bottom: $spacing-6;
        }

        &__actions {
          display: flex;
          justify-content: space-between;
          margin-top: $spacing-8;
          border-top: 1px solid $border-light;
          padding-top: $spacing-5;

          button {
            @include flex-center;
            gap: $spacing-2;
          }

          // Align right for first step
          &:first-child,
          button:only-child {
            margin-left: auto;
          }
        }
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 0 $spacing-4;

        .col-12 {
          grid-column: span 12;
        }
        .col-6 {
          grid-column: span 12;
        }

        @include sm {
          .col-6 {
            grid-column: span 6;
          }
        }
      }

      // ─── AI analysis box styling ───
      .loading-box {
        @include flex-column-center;
        padding: $spacing-12 $spacing-4;
        color: $text-secondary;
        gap: $spacing-4;

        p {
          font-size: $font-size-sm;
        }
      }

      .ai-box {
        display: flex;
        flex-direction: column;
        gap: $spacing-4;

        &__score {
          display: flex;
          align-items: center;
          gap: $spacing-6;
          background: linear-gradient(135deg, rgba($primary, 0.04) 0%, rgba($info, 0.04) 100%);
          border: 1px solid rgba($primary, 0.1);
          padding: $spacing-4 $spacing-5;
          border-radius: $radius-lg;

          @include mobile-only {
            flex-direction: column;
            text-align: center;
          }
        }

        &__metrics {
          display: flex;
          flex-direction: column;
          gap: $spacing-2;
        }
      }

      .radial-score {
        @include flex-column-center;
        width: 72px;
        height: 72px;
        border-radius: $radius-full;
        background: $primary-light;
        border: 3px solid $primary;
        flex-shrink: 0;

        .value {
          font-size: $font-size-lg;
          font-weight: $font-weight-bold;
          color: $primary-dark;
        }

        .label {
          font-size: 8px;
          text-transform: uppercase;
          color: $primary-dark;
          font-weight: $font-weight-semibold;
        }
      }

      .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: $spacing-2;
        font-size: $font-size-sm;
        color: $text-secondary;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        strong {
          color: $text-primary;
        }

        &.priority {
          strong {
            padding: 2px $spacing-2;
            border-radius: $radius-sm;
            font-size: $font-size-xs;
          }

          &.low strong {
            background: $primary-light;
            color: $primary-dark;
          }
          &.medium strong {
            background: $warning-light;
            color: $warning;
          }
          &.high strong {
            background: #fee2e2;
            color: $danger;
          }
          &.critical strong {
            background: #7f1d1d;
            color: $text-inverse;
          }
        }
      }

      .ai-warning-card {
        display: flex;
        gap: $spacing-3;
        background: $warning-light;
        border: 1px solid rgba($warning, 0.2);
        padding: $spacing-4;
        border-radius: $radius-lg;
        color: #92400e;

        mat-icon {
          color: $warning;
        }
        h4 {
          font-size: $font-size-sm;
          font-weight: $font-weight-bold;
          margin-bottom: 2px;
        }
        p {
          font-size: $font-size-xs;
          margin: 0;
        }
      }

      .ai-success-card {
        display: flex;
        align-items: center;
        gap: $spacing-3;
        background: #d1fae5;
        border: 1px solid rgba($success, 0.15);
        padding: $spacing-3 $spacing-4;
        border-radius: $radius-lg;
        color: $primary-dark;
        font-size: $font-size-xs;
        margin: 0;

        mat-icon {
          color: $success;
        }
      }

      .ai-card {
        display: flex;
        gap: $spacing-4;
        background: $background;
        border: 1px solid $border;
        padding: $spacing-4;
        border-radius: $radius-lg;

        &__icon {
          color: $primary;
        }

        &__body {
          h4 {
            font-size: $font-size-xs;
            color: $text-secondary;
            margin-bottom: 2px;
            text-transform: uppercase;
            font-weight: $font-weight-bold;
          }
          p {
            font-size: $font-size-sm;
            color: $text-primary;
            margin: 0;
          }
        }
      }

      .override-category {
        background: $background;
        padding: $spacing-4;
        border-radius: $radius-lg;
        border: 1px solid $border-light;
        margin-top: $spacing-2;

        p {
          font-size: $font-size-xs;
          color: $text-secondary;
          margin-bottom: $spacing-3;
        }
      }

      // ─── Image upload zone ───
      .upload-zone {
        @include flex-column-center;
        padding: $spacing-10 $spacing-6;
        border: 2px dashed $border;
        border-radius: $radius-xl;
        background: $background;
        cursor: pointer;
        transition: all $transition-fast;
        margin-bottom: $spacing-6;

        &:hover {
          border-color: $primary;
          background: rgba($primary, 0.02);
        }

        &__icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
          color: $primary;
          margin-bottom: $spacing-2;
        }

        &__title {
          font-size: $font-size-sm;
          font-weight: $font-weight-semibold;
          color: $text-primary;
          margin-bottom: 2px;
        }

        &__limits {
          font-size: $font-size-xs;
          color: $text-muted;
        }
      }

      .image-gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: $spacing-4;
        margin-bottom: $spacing-4;
      }

      .image-tile {
        position: relative;
        border-radius: $radius-lg;
        overflow: hidden;
        aspect-ratio: 1;
        border: 1px solid $border;
        box-shadow: $shadow-sm;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        &__overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: $spacing-2;
          opacity: 0;
          transition: opacity $transition-fast;

          &:hover {
            opacity: 1;
          }

          .filename {
            color: $text-inverse;
            font-size: 10px;
            @include text-truncate;
          }

          .remove-btn {
            align-self: flex-end;
            background: transparent;
            border: none;
            color: #ef4444;
            cursor: pointer;
            padding: 2px;
            border-radius: $radius-sm;

            &:hover {
              background: rgba(255, 255, 255, 0.2);
            }
          }
        }
      }

      // ─── Review box ───
      .review-box {
        display: flex;
        flex-direction: column;
        gap: $spacing-5;
        background: $background;
        padding: $spacing-6;
        border-radius: $radius-xl;
        border: 1px solid $border;

        &__section {
          border-bottom: 1px solid $border-light;
          padding-bottom: $spacing-4;

          &:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          h4 {
            font-size: $font-size-sm;
            font-weight: $font-weight-bold;
            color: $primary-dark;
            margin-bottom: $spacing-2;
            text-transform: uppercase;
          }

          p {
            font-size: $font-size-sm;
            margin-bottom: 6px;
            color: $text-primary;

            &:last-child {
              margin-bottom: 0;
            }
          }
        }
      }

      .priority-text {
        font-weight: $font-weight-bold;
        &.low {
          color: $primary;
        }
        &.medium {
          color: $warning;
        }
        &.high {
          color: $danger;
        }
        &.critical {
          color: #7f1d1d;
        }
      }

      .review-images {
        display: flex;
        flex-wrap: wrap;
        gap: $spacing-3;

        .thumb {
          width: 60px;
          height: 60px;
          border-radius: $radius-md;
          overflow: hidden;
          border: 1px solid $border;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
      }
    `,
  ],
})
export class ComplaintSubmitComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly complaintsService = inject(ComplaintsService);
  private readonly notification = inject(NotificationService);

  readonly currentStep = signal(1);
  readonly categories = COMPLAINT_CATEGORIES;
  readonly steps = [
    { num: 1, label: 'Issue Details' },
    { num: 2, label: 'AI Review' },
    { num: 3, label: 'Attachments' },
    { num: 4, label: 'Submit Report' },
  ];

  // Forms
  readonly infoForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    category: ['', Validators.required],
    address: ['', Validators.required],
  });

  // State signals
  readonly analyzing = signal(false);
  readonly submitting = signal(false);
  readonly aiAnalysis = signal<AIAnalysis | null>(null);
  readonly confirmedCategory = signal<string>('');
  readonly uploadedImages = signal<UploadedImage[]>([]);
  readonly todayDate = new Date();

  goToStep2(): void {
    if (this.infoForm.invalid) return;

    this.currentStep.set(2);
    this.analyzing.set(true);

    const draft = {
      title: this.infoForm.value.title || '',
      description: this.infoForm.value.description || '',
      location: {
        latitude: 12.9716, // Default coordinates for simulation
        longitude: 77.5946,
        address: this.infoForm.value.address || '',
      },
    };

    this.complaintsService.analyzeDraft(draft).subscribe({
      next: (res) => {
        this.analyzing.set(false);
        if (res.success && res.data?.analysis) {
          this.aiAnalysis.set(res.data.analysis);
          this.confirmedCategory.set(res.data.analysis.category);
        }
      },
      error: (err) => {
        this.analyzing.set(false);
        this.notification.error('AI analysis request failed. You can classify manually.');
        // Fallback placeholder
        this.aiAnalysis.set({
          category: this.infoForm.value.category || 'Other',
          priority: 'medium',
          department: 'General Services Department',
          duplicateDetected: false,
          summary: this.infoForm.value.title || '',
          confidenceScore: 70,
        });
        this.confirmedCategory.set(this.infoForm.value.category || 'Other');
      },
    });
  }

  updateConfirmedCategory(val: string): void {
    this.confirmedCategory.set(val);
  }

  goToStep3(): void {
    this.currentStep.set(3);
  }

  goToStep4(): void {
    this.currentStep.set(4);
  }

  prevStep(): void {
    this.currentStep.update((s) => s - 1);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);

    // Limit to 3 images total
    if (this.uploadedImages().length + files.length > 3) {
      this.notification.warning('You can upload a maximum of 3 photos.');
      return;
    }

    for (const file of files) {
      // Validation: format
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        this.notification.error(`"${file.name}" has an invalid format. Only JPG/PNG are allowed.`);
        continue;
      }

      // Validation: size (max 2MB = 2097152 bytes)
      if (file.size > 2 * 1024 * 1024) {
        this.notification.error(`"${file.name}" exceeds the 2MB size limit.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        this.uploadedImages.update((imgs) => [
          ...imgs,
          {
            base64Data: base64String,
            contentType: file.type,
            fileName: file.name,
          },
        ]);
      };
      reader.onerror = () => {
        this.notification.error(`Failed to read file: "${file.name}"`);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(idx: number): void {
    this.uploadedImages.update((imgs) => imgs.filter((_, i) => i !== idx));
  }

  submit(): void {
    this.submitting.set(true);

    const payload = {
      title: this.infoForm.value.title || '',
      description: this.infoForm.value.description || '',
      category: this.confirmedCategory(),
      location: {
        latitude: 12.9716, // Simulating center coords
        longitude: 77.5946,
        address: this.infoForm.value.address || '',
      },
      images: this.uploadedImages(),
    };

    this.complaintsService.submitComplaint(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.notification.success('Your complaint has been successfully reported!');
          this.router.navigate(['/', ROUTE_PATHS.complaints.root]);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.notification.error(
          err.error?.message || 'Failed to submit complaint. Please check your data.',
        );
      },
    });
  }
}
