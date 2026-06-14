# Database Design - Inlight Agency OS

## Database Architecture Overview

Inlight Agency OS uses a relational database model with PostgreSQL as the primary data store, supplemented by Redis for caching and session management. The design prioritizes data integrity, performance, and scalability.

## Core Database Components

### Primary Database (PostgreSQL)
- Transactional data storage
- ACID compliance
- Complex relationship management
- Full-text search capabilities
- JSON/JSONB for flexible data structures

### Cache Layer (Redis)
- Session storage
- Real-time data caching
- Rate limiting counters
- Message queue for async operations
- Pub/Sub for real-time notifications

## Entity Relationship Model

### Core Entities

#### 1. Organizations & Users

**Organization**
```
Fields:
  - id (UUID, PK)
  - name (VARCHAR)
  - description (TEXT)
  - industry (VARCHAR)
  - size (ENUM)
  - website (VARCHAR)
  - timezone (VARCHAR)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**User**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - email (VARCHAR, UNIQUE)
  - first_name (VARCHAR)
  - last_name (VARCHAR)
  - phone (VARCHAR)
  - avatar_url (VARCHAR)
  - role_id (UUID, FK)
  - status (ENUM: active, inactive, suspended)
  - last_login (TIMESTAMP)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Role**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - name (VARCHAR)
  - description (TEXT)
  - permissions (JSONB)
  - is_system_role (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Permission**
```
Fields:
  - id (UUID, PK)
  - name (VARCHAR, UNIQUE)
  - description (TEXT)
  - resource (VARCHAR)
  - action (VARCHAR)
  - created_at (TIMESTAMP)
```

#### 2. CRM Entities

**Company**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - name (VARCHAR)
  - industry (VARCHAR)
  - size (ENUM)
  - website (VARCHAR)
  - phone (VARCHAR)
  - email (VARCHAR)
  - address (TEXT)
  - city (VARCHAR)
  - state (VARCHAR)
  - country (VARCHAR)
  - zip_code (VARCHAR)
  - billing_address (TEXT)
  - tax_id (VARCHAR)
  - annual_revenue (DECIMAL)
  - employee_count (INTEGER)
  - company_type (ENUM: client, prospect, partner, vendor)
  - status (ENUM: active, inactive, suspended)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Contact**
```
Fields:
  - id (UUID, PK)
  - company_id (UUID, FK)
  - first_name (VARCHAR)
  - last_name (VARCHAR)
  - email (VARCHAR)
  - phone (VARCHAR)
  - title (VARCHAR)
  - department (VARCHAR)
  - office_phone (VARCHAR)
  - mobile_phone (VARCHAR)
  - fax (VARCHAR)
  - mailing_address (TEXT)
  - preferred_contact_method (ENUM)
  - is_primary_contact (BOOLEAN)
  - status (ENUM: active, inactive)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Interaction**
```
Fields:
  - id (UUID, PK)
  - company_id (UUID, FK)
  - contact_id (UUID, FK)
  - user_id (UUID, FK)
  - interaction_type (ENUM: call, email, meeting, note)
  - subject (VARCHAR)
  - description (TEXT)
  - date (TIMESTAMP)
  - duration_minutes (INTEGER)
  - outcome (VARCHAR)
  - next_action (TEXT)
  - next_action_date (DATE)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

#### 3. Project Management Entities

**Project**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - company_id (UUID, FK)
  - name (VARCHAR)
  - description (TEXT)
  - status (ENUM: planning, active, paused, completed, cancelled)
  - project_manager_id (UUID, FK)
  - start_date (DATE)
  - end_date (DATE)
  - estimated_budget (DECIMAL)
  - actual_budget (DECIMAL)
  - budget_currency (VARCHAR)
  - priority (ENUM: low, medium, high, critical)
  - visibility (ENUM: private, team, public)
  - project_template_id (UUID, FK)
  - metadata (JSONB)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Milestone**
```
Fields:
  - id (UUID, PK)
  - project_id (UUID, FK)
  - name (VARCHAR)
  - description (TEXT)
  - status (ENUM: pending, in_progress, completed, delayed)
  - start_date (DATE)
  - due_date (DATE)
  - completion_date (DATE)
  - order_index (INTEGER)
  - is_critical (BOOLEAN)
  - deliverables (JSONB)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Task**
```
Fields:
  - id (UUID, PK)
  - project_id (UUID, FK)
  - milestone_id (UUID, FK)
  - title (VARCHAR)
  - description (TEXT)
  - status (ENUM: todo, in_progress, review, completed, blocked)
  - priority (ENUM: low, medium, high, critical)
  - assigned_to_id (UUID, FK)
  - assigned_by_id (UUID, FK)
  - created_by_id (UUID, FK)
  - start_date (DATE)
  - due_date (DATE)
  - completion_date (DATE)
  - estimated_hours (DECIMAL)
  - actual_hours (DECIMAL)
  - order_index (INTEGER)
  - parent_task_id (UUID, FK)
  - dependencies (JSONB)
  - metadata (JSONB)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**TaskComment**
```
Fields:
  - id (UUID, PK)
  - task_id (UUID, FK)
  - user_id (UUID, FK)
  - comment_text (TEXT)
  - mentions (JSONB)
  - attachments (JSONB)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

#### 4. Financial Entities

**Invoice**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - project_id (UUID, FK)
  - company_id (UUID, FK)
  - invoice_number (VARCHAR, UNIQUE)
  - status (ENUM: draft, sent, paid, overdue, cancelled)
  - issue_date (DATE)
  - due_date (DATE)
  - subtotal (DECIMAL)
  - tax_amount (DECIMAL)
  - discount_amount (DECIMAL)
  - total_amount (DECIMAL)
  - currency (VARCHAR)
  - payment_terms (VARCHAR)
  - notes (TEXT)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
  - paid_at (TIMESTAMP)
```

**InvoiceLineItem**
```
Fields:
  - id (UUID, PK)
  - invoice_id (UUID, FK)
  - description (VARCHAR)
  - quantity (DECIMAL)
  - unit_price (DECIMAL)
  - line_total (DECIMAL)
  - tax_rate (DECIMAL)
  - order_index (INTEGER)
  - created_at (TIMESTAMP)
```

**Expense**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - project_id (UUID, FK)
  - user_id (UUID, FK)
  - category (VARCHAR)
  - description (VARCHAR)
  - amount (DECIMAL)
  - currency (VARCHAR)
  - expense_date (DATE)
  - receipt_url (VARCHAR)
  - status (ENUM: draft, submitted, approved, rejected, reimbursed)
  - approver_id (UUID, FK)
  - approval_date (DATE)
  - notes (TEXT)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**EstimateProposal**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - company_id (UUID, FK)
  - estimate_number (VARCHAR, UNIQUE)
  - status (ENUM: draft, sent, accepted, rejected, expired)
  - scope_of_work (TEXT)
  - subtotal (DECIMAL)
  - tax_amount (DECIMAL)
  - discount_amount (DECIMAL)
  - total_amount (DECIMAL)
  - currency (VARCHAR)
  - valid_until (DATE)
  - notes (TEXT)
  - created_by_id (UUID, FK)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
  - accepted_at (TIMESTAMP)
```

#### 5. Resource Management Entities

**TeamMember**
```
Fields:
  - id (UUID, PK)
  - user_id (UUID, FK)
  - organization_id (UUID, FK)
  - job_title (VARCHAR)
  - department (VARCHAR)
  - manager_id (UUID, FK)
  - hire_date (DATE)
  - cost_per_hour (DECIMAL)
  - billable_rate (DECIMAL)
  - utilization_target (DECIMAL)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Skill**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - name (VARCHAR)
  - category (VARCHAR)
  - description (TEXT)
  - created_at (TIMESTAMP)
```

**TeamMemberSkill**
```
Fields:
  - id (UUID, PK)
  - team_member_id (UUID, FK)
  - skill_id (UUID, FK)
  - proficiency_level (ENUM: beginner, intermediate, advanced, expert)
  - years_of_experience (INTEGER)
  - is_primary_skill (BOOLEAN)
  - verified (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Availability**
```
Fields:
  - id (UUID, PK)
  - team_member_id (UUID, FK)
  - date (DATE)
  - status (ENUM: available, partially_available, unavailable)
  - available_hours (DECIMAL)
  - notes (TEXT)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**TimeEntry**
```
Fields:
  - id (UUID, PK)
  - team_member_id (UUID, FK)
  - project_id (UUID, FK)
  - task_id (UUID, FK)
  - entry_date (DATE)
  - hours_worked (DECIMAL)
  - billable (BOOLEAN)
  - bill_rate (DECIMAL)
  - cost_rate (DECIMAL)
  - description (TEXT)
  - status (ENUM: draft, submitted, approved, rejected)
  - approver_id (UUID, FK)
  - approval_date (DATE)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

#### 6. Communication Entities

**Message**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - from_user_id (UUID, FK)
  - to_user_id (UUID, FK)
  - channel_id (UUID, FK)
  - message_text (TEXT)
  - message_type (ENUM: text, file, link, mention)
  - mentions (JSONB)
  - attachments (JSONB)
  - is_edited (BOOLEAN)
  - is_deleted (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Channel**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - name (VARCHAR)
  - description (TEXT)
  - is_private (BOOLEAN)
  - created_by_id (UUID, FK)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Notification**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - user_id (UUID, FK)
  - notification_type (VARCHAR)
  - title (VARCHAR)
  - message (TEXT)
  - entity_type (VARCHAR)
  - entity_id (UUID)
  - is_read (BOOLEAN)
  - read_at (TIMESTAMP)
  - channels (JSONB)
  - created_at (TIMESTAMP)
```

#### 7. Integration Entities

**Integration**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - integration_type (VARCHAR)
  - name (VARCHAR)
  - description (TEXT)
  - is_enabled (BOOLEAN)
  - credentials (JSONB)
  - configuration (JSONB)
  - status (ENUM: active, inactive, error)
  - last_sync (TIMESTAMP)
  - error_message (TEXT)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

**Webhook**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - event_type (VARCHAR)
  - endpoint_url (VARCHAR)
  - is_active (BOOLEAN)
  - retry_count (INTEGER)
  - last_triggered (TIMESTAMP)
  - created_at (TIMESTAMP)
```

#### 8. Audit & Logging Entities

**AuditLog**
```
Fields:
  - id (UUID, PK)
  - organization_id (UUID, FK)
  - user_id (UUID, FK)
  - action (VARCHAR)
  - entity_type (VARCHAR)
  - entity_id (UUID)
  - changes (JSONB)
  - old_values (JSONB)
  - new_values (JSONB)
  - ip_address (VARCHAR)
  - user_agent (VARCHAR)
  - created_at (TIMESTAMP)
```

## Indexing Strategy

### Primary Indexes
```
Key Indexes:
  - users(organization_id, status)
  - companies(organization_id, status)
  - projects(organization_id, status, company_id)
  - tasks(project_id, status, assigned_to_id)
  - invoices(organization_id, company_id, status)
  - interactions(company_id, created_at)
  - time_entries(team_member_id, entry_date)
  - messages(organization_id, created_at)
  - audit_logs(organization_id, created_at)
```

### Performance Indexes
```
Full-text search:
  - companies(name, USING GIN)
  - contacts(email, phone)
  - projects(name, description)
```

## Partitioning Strategy

### Time-based Partitioning
- AuditLog: Partitioned by month
- Message: Partitioned by quarter
- TimeEntry: Partitioned by quarter

### Range Partitioning
- Projects: By status and creation date
- Invoices: By creation date

## Backup & Recovery

### Backup Strategy
- Hourly incremental backups
- Daily full backups
- Weekly cross-region backups
- 90-day retention policy
- Monthly backup verification

### Recovery Procedures
- RTO: < 1 hour
- RPO: < 15 minutes
- Test recovery procedures monthly
- Document recovery procedures

## Data Consistency & Integrity

### Constraints
- Foreign key constraints for referential integrity
- Unique constraints on business identifiers
- Check constraints for valid values
- NOT NULL constraints where applicable

### Transactions
- ACID compliance for critical operations
- Isolation level: Read Committed
- Optimistic locking for concurrent updates
- Transaction logging and rollback capability

## Scalability Considerations

### Horizontal Scaling
- Database read replicas for reporting queries
- Database sharding by organization_id for multi-tenancy
- Connection pooling (PgBouncer)
- Query optimization and index tuning

### Performance Optimization
- Query execution plan analysis
- Index usage statistics
- Query result caching
- Materialized views for complex reports
- Denormalization where appropriate

## Data Privacy & Security

### Data Classification
- Public: Non-sensitive organizational data
- Internal: Internal operational data
- Confidential: Sensitive client and financial data
- Restricted: Personal data and compliance data

### Encryption
- Sensitive fields encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- Column-level encryption for PII
- Transparent Data Encryption (TDE) for database

### Access Control
- Role-based access control (RBAC)
- Row-level security (RLS) for multi-tenancy
- Audit logging for all data access
- API authentication and authorization

## Migration & Versioning

### Schema Versioning
- Semantic versioning for schema versions
- Migration scripts for version upgrades
- Backward compatibility for at least 2 versions
- Rollback procedures for failed migrations

### Data Migration
- Blue-green deployment for zero-downtime migrations
- Validation of migrated data
- Reconciliation of pre and post-migration data
- Monitoring during migration process
