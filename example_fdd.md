# Functional Design Document (FDD)
# Project: Online Learning Management System (LMS)
# Version: 1.0
# Date: 2025-01-01

---

## 1. Introduction

### 1.1 Purpose
This document describes the functional requirements for an Online Learning Management System (LMS) that allows educational institutions to create, manage, and deliver online courses to students.

### 1.2 Scope
The system shall support course creation, student enrollment, assignment submission, grading, video lectures, and reporting functionalities.

### 1.3 Stakeholders
- Students: End users who consume course content
- Instructors: Create and manage course content
- Admin: Manage platform, users, and analytics
- Institution: Owns the platform and data

---

## 2. Functional Requirements

### 2.1 User Management

FR-001: The system shall allow users to register an account with email and password.
FR-002: The system shall allow users to log in using email/password or OAuth (Google, GitHub).
FR-003: The system shall support three roles: Student, Instructor, and Admin.
FR-004: Users shall be able to update their profile including name, bio, and profile picture.
FR-005: The system shall allow admin to deactivate or ban user accounts.
FR-006: Users must verify their email address before accessing course content.

### 2.2 Course Management

FR-007: Instructors shall be able to create a new course with title, description, category, and price.
FR-008: The system shall allow instructors to add modules and lessons to a course.
FR-009: Instructors shall be able to upload video lectures (MP4 format, max 2GB per file).
FR-010: The system shall support course categories such as Technology, Business, Arts, and Science.
FR-011: Instructors shall be able to set a course as draft or published.
FR-012: The system must allow instructors to add quizzes and assignments to lessons.
FR-013: Courses shall support a thumbnail image upload for course listings.

### 2.3 Student Enrollment

FR-014: Students shall be able to search and browse available courses.
FR-015: The system shall allow students to enroll in free courses instantly.
FR-016: Students must complete payment via Stripe before enrolling in paid courses.
FR-017: The system shall send an enrollment confirmation email to the student upon successful enrollment.
FR-018: Students shall be able to view their enrolled courses in a personal dashboard.

### 2.4 Content Delivery

FR-019: Students shall be able to watch video lectures in an embedded video player.
FR-020: The system must track lesson completion for each student.
FR-021: Students shall be able to download course materials (PDFs, slides).
FR-022: The system shall display a progress bar showing course completion percentage.
FR-023: Students must complete all lessons in a module before accessing the next module.

### 2.5 Assessment and Grading

FR-024: The system shall allow students to submit assignments as file uploads.
FR-025: Instructors shall be able to grade submitted assignments and provide feedback.
FR-026: The system shall automatically grade multiple-choice quizzes.
FR-027: Students shall receive a certificate of completion upon finishing a course with a passing grade (>= 60%).
FR-028: The system must maintain a gradebook for each course showing all student grades.

### 2.6 Communication

FR-029: The system shall provide an in-platform messaging system between students and instructors.
FR-030: The system must send automated email notifications for new assignments, grades posted, and enrollment confirmations.
FR-031: Instructors shall be able to post announcements visible to all enrolled students.

### 2.7 Reporting and Analytics

FR-032: Admin shall be able to view platform-level analytics including total users, enrollments, and revenue.
FR-033: Instructors shall be able to view course analytics including enrollment count, completion rate, and student progress.
FR-034: The system shall generate monthly revenue reports exportable as CSV.

---

## 3. Business Rules

BR-001: A student cannot enroll in the same course more than once.
BR-002: Instructors must have at least one published course to receive payouts.
BR-003: The platform shall retain 30% commission on each paid course sale.
BR-004: Certificates shall only be issued when the student achieves a grade of 60% or higher.
BR-005: Video upload must not exceed 2GB per file and 20GB total storage per instructor.
BR-006: Free trial access shall be limited to the first two lessons of any course.
BR-007: Student data must comply with GDPR and FERPA regulations.

---

## 4. Workflows

### 4.1 Student Registration Flow
Step 1: Student visits registration page and fills out the form.
Step 2: System validates email uniqueness and password strength.
Step 3: System creates user account with "unverified" status.
Step 4: System sends verification email.
Step 5: Student clicks verification link.
Step 6: System activates the account.

### 4.2 Course Purchase and Enrollment Flow
Step 1: Student browses course catalog and selects a course.
Step 2: Student clicks "Enroll Now" button.
Step 3: If free course, student is immediately enrolled.
Step 4: If paid course, student is redirected to Stripe checkout.
Step 5: Upon successful payment, Stripe webhook triggers enrollment.
Step 6: System sends confirmation email and grants course access.

### 4.3 Assignment Submission Flow
Step 1: Instructor creates assignment with due date and instructions.
Step 2: Student views assignment and uploads file submission.
Step 3: System records submission timestamp and notifies instructor.
Step 4: Instructor reviews submission and posts grade with feedback.
Step 5: Student receives notification of grade posting.

---

## 5. Non-Functional Requirements

NFR-001: The system shall support up to 50,000 concurrent users.
NFR-002: Page load times shall not exceed 3 seconds under normal load.
NFR-003: The system shall have 99.9% uptime (SLA).
NFR-004: All user data shall be encrypted at rest using AES-256.
NFR-005: API responses shall not exceed 500ms for 95% of requests.
NFR-006: The system shall be accessible on mobile devices (responsive design).

---

## 6. System Integrations

- Stripe: Payment processing for course purchases
- SendGrid: Transactional email delivery
- AWS S3: Video and file storage
- YouTube API (optional): Embed external video content
- Google OAuth / GitHub OAuth: Social login

---

## 7. Constraints

- The backend shall be built using Node.js and Python microservices.
- The frontend shall use React.js.
- Primary database shall be PostgreSQL.
- Redis shall be used for caching and session management.
- Docker shall be used for containerization.
- The system must be deployable on AWS infrastructure.
