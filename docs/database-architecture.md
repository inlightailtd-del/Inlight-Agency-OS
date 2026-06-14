# Database Architecture - Inlight Agency OS
## Enterprise Data Design for AI Operating System

## Database Architecture Overview

Inlight Agency OS employs a sophisticated, multi-layer data architecture optimized for real-time operations, analytics, and AI/ML integration.

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│              Application Layer                              │
│  Services, Agents, API Gateway                             │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┴─────────────────────────────────┐
│        Data Access & Cache Layer                           │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────┐        │
│  │ Connection   │  │  Cache   │  │ Query        │        │
│  │ Pool         │  │ Layer    │  │ Optimizer    │        │
│  └──────────────┘  └──────────┘  └──────────────┘        │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────┴─────────────────────────────────┐
│        Transactional Data Layer                            │
│  ┌───────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Primary + Read Replicas)             │   │
│  │  ◇ ACID Transactions                              │   │
│  │  ◇ Row-Level Security                             │   │
│  │  ◇ Full-Text Search                               │   │
│  │  ◇ JSON/JSONB Support                             │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────┴─────────────────────────────────┐
│        Specialized Data Storage Layer                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Analytics Data │  │ Vector Store │  │ File Store  │  │
│  │ Warehouse      │  │ (Semantic    │  │ (S3/Cloud)  │  │
│  │ (DuckDB/Big    │  │  Search)     │  │             │  │
│  │  Query)        │  │ (Pinecone)   │  │             │  │
│  └────────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Core Database (PostgreSQL)

### Design Philosophy
- **Relational Model**: Normalized for ACID compliance
- **Multi-tenancy**: Organization-level isolation
- **Extensibility**: JSONB columns for flexible attributes
- **Performance**: Strategic denormalization where needed
- **Auditability**: Complete audit trails

### Entity Categories

#### 1. Organization & Users
- **organizations**: Company data, settings, features
- **users**: User accounts, authentication, preferences
- **roles**: Permission sets and role definitions
- **permissions**: Granular permission definitions
- **user_organization_mapping**: Multi-org user support
- **api_keys**: API authentication tokens

#### 2. Company Brain (CRM Core)
- **companies**: Client/prospect/partner/vendor organizations
- **company_metadata**: Extensible company attributes
- **contacts**: Individual contacts within companies
- **contact_roles**: Contact job titles and responsibilities
- **interactions**: Call logs, emails, meetings, notes
- **interaction_notes**: Detailed notes and follow-ups
- **company_segments**: Segmentation and categorization
- **relationship_strength**: Client relationship metrics

#### 3. Project & Delivery Management
- **projects**: Project records with metadata
- **project_statuses**: Project status history
- **milestones**: Project milestones and phases
- **milestone_dependencies**: Milestone relationships
- **tasks**: Granular task records
- **task_assignments**: Task ownership and tracking
- **task_subtasks**: Task hierarchy
- **task_comments**: Task discussions
- **task_attachments**: Task-related files
- **deliverables**: Project deliverable tracking

#### 4. Financial Operations
- **invoices**: Invoice records
- **invoice_line_items**: Invoice line details
- **invoice_payments**: Payment tracking
- **invoice_status_history**: Invoice status changes
- **estimates**: Sales estimates and proposals
- **estimate_line_items**: Estimate details
- **expenses**: Expense records
- **expense_approvals**: Approval workflow
- **recurring_invoices**: Automated invoicing setup
- **payment_terms**: Payment term definitions
- **financial_metrics**: Project profitability data

#### 5. Sales Pipeline
- **leads**: Sales leads
- **lead_sources**: Lead origin tracking
- **opportunities**: Sales opportunities
- **opportunity_stages**: Pipeline stage definitions
- **opportunity_activities**: Activity tracking
- **sales_forecasts**: Revenue forecasting
- **deal_status**: Deal progress tracking

#### 6. Resource & Talent Management
- **team_members**: Employee records
- **team_member_skills**: Skill mappings
- **skills**: Skill catalog
- **skill_categories**: Skill organization
- **team_availability**: Capacity calendar
- **time_entries**: Time tracking records
- **time_entry_approvals**: Time approval workflow
- **capacity_forecasts**: Resource forecasting
- **team_member_performance**: Performance metrics

#### 7. Content Management
- **content_pieces**: Blog posts, articles, assets
- **content_calendar**: Content planning
- **content_templates**: Reusable templates
- **content_assets**: Media and file management
- **content_performance**: Analytics and metrics

#### 8. Marketing Operations
- **campaigns**: Marketing campaigns
- **campaign_activities**: Campaign tasks and actions
- **campaign_performance**: Campaign metrics
- **marketing_metrics**: Department-wide metrics
- **email_templates**: Email campaign templates

#### 9. Collaboration & Communication
- **channels**: Communication channels
- **messages**: Chat messages and discussions
- **message_attachments**: File attachments
- **notifications**: User notifications
- **notification_preferences**: User notification settings
- **activity_feed**: Activity stream records
- **mentions**: @mention tracking
- **comment_threads**: Nested discussions

#### 10. Knowledge Base & Learning
- **knowledge_articles**: Documentation and guides
- **article_categories**: Knowledge organization
- **article_versions**: Version control
- **lessons_learned**: Project retrospectives
- **best_practices**: Process best practices
- **templates**: Project/process templates
- **template_versions**: Template versioning
- **article_tags**: Semantic tagging
- **article_search_index**: Full-text search index

#### 11. Integrations
- **integrations**: Third-party integrations
- **integration_credentials**: Secure credential storage
- **webhooks**: Webhook definitions
- **webhook_logs**: Webhook delivery tracking
- **api_connections**: External API connections
- **sync_logs**: Data sync history

#### 12. Audit & Compliance
- **audit_logs**: Complete audit trail
- **user_activity_logs**: User action tracking
- **data_access_logs**: Data access audit
- **compliance_logs**: Compliance tracking
- **field_history**: Individual field change history
- **entity_snapshots**: Point-in-time entity snapshots

### Performance Indexing Strategy

**Primary Indexes** (for query performance):
```sql
-- Organization & User
CREATE INDEX idx_users_org ON users(organization_id, status);
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id, is_active);

-- CRM
CREATE INDEX idx_companies_org ON companies(organization_id, status);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_interactions_company ON interactions(company_id, created_at DESC);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);

-- Projects & Tasks
CREATE INDEX idx_projects_org ON projects(organization_id, status);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_tasks_project ON tasks(project_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_id, status);

-- Financial
CREATE INDEX idx_invoices_company ON invoices(company_id, status);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_time_entries_member ON time_entries(team_member_id, entry_date);

-- Search
CREATE INDEX idx_companies_name ON companies USING GIN(name gin_trgm_ops);
CREATE INDEX idx_contacts_email ON contacts USING GIN(email gin_trgm_ops);
```

### Partitioning Strategy

**Time-Based Partitioning** (for large tables):
```
- audit_logs: Partitioned by month
- messages: Partitioned by quarter
- time_entries: Partitioned by quarter
- webhook_logs: Partitioned by month
```

**Range Partitioning**:
```
- projects: By status and creation date
- invoices: By creation date
- tasks: By project_id
```

## Analytics Data Warehouse

### Purpose
Optimized for reporting, analytics, and business intelligence queries without impacting transactional performance.

### Architecture
- **DuckDB** or **BigQuery** for analytics engine
- **Dimensional modeling** with fact and dimension tables
- **Real-time and batch updates** from PostgreSQL
- **Optimized aggregations** and pre-computed metrics

### Key Fact Tables
- **project_facts**: Project metrics
- **financial_facts**: Revenue and expense metrics
- **sales_facts**: Pipeline and conversion metrics
- **resource_facts**: Utilization and allocation metrics
- **client_facts**: Client lifetime value metrics

### Key Dimension Tables
- **date_dim**: Time dimensions
- **org_dim**: Organization hierarchy
- **client_dim**: Client information
- **project_dim**: Project information
- **team_dim**: Resource information

## Cache Layer (Redis)

### Caching Strategy
- **Session Management**: User sessions and auth tokens
- **Real-time Data**: Frequently accessed entities
- **Rate Limiting**: API quota tracking
- **Queues**: Background job queues
- **Pub/Sub**: Real-time notifications

### Key Cache Patterns
```
keys:
  user:{user_id}:session:{token}
  org:{org_id}:config
  company:{company_id}:full
  project:{project_id}:tasks
  user:{user_id}:notifications
  api_key:{key}:quota
  cache:lock:{resource_id}
```

## Vector Store (Semantic Search)

### Purpose
Enable semantic similarity search for knowledge base and content discovery.

### Implementation
- **Pinecone** or **Weaviate** for vector embeddings
- **Embedding Model**: Sentence transformers or OpenAI embeddings
- **Use Cases**:
  - Similar document/template discovery
  - Knowledge base search
  - Recommendation engine
  - Content similarity

### Key Collections
- **knowledge_articles**: Article embeddings
- **templates**: Template embeddings
- **lessons_learned**: Lesson embeddings
- **documents**: Document embeddings

## File Storage (S3/Cloud Storage)

### Organization
```
s3://inlight-data-{env}/
├── organizations/
│   ├── {org_id}/
│   │   ├── projects/
│   │   │   └── {project_id}/
│   │   │       ├── deliverables/
│   │   │       └── uploads/
│   │   ├── documents/
│   │   ├── templates/
│   │   └── backups/
├── user-uploads/
├── temp/
└── archives/
```

## Data Consistency & Integrity

### Transaction Handling
- **ACID Compliance**: All critical operations in transactions
- **Isolation Levels**: Read Committed for most operations
- **Optimistic Locking**: For concurrent updates
- **Distributed Transactions**: For cross-service operations

### Foreign Key Constraints
- Enforce referential integrity
- Cascade updates/deletes where appropriate
- Restrict deletes for audit data

### Data Validation
- Application-level validation
- Database-level constraints
- Business rule enforcement

## Backup & Disaster Recovery

### Backup Strategy
- **Hourly Incremental**: Incremental backups hourly
- **Daily Full**: Full backup daily
- **Weekly Cross-Region**: Backup copies to alternate region
- **Retention**: 90-day retention policy minimum

### Recovery Procedures
- **RTO**: < 1 hour (Recovery Time Objective)
- **RPO**: < 15 minutes (Recovery Point Objective)
- **Monthly Drills**: Test recovery procedures monthly
- **Verification**: Automated backup verification

## Multi-Tenancy Architecture

### Isolation Levels
- **Logical Isolation**: Row-level security by organization
- **Connection Isolation**: Separate connection pools per tenant
- **Cache Isolation**: Separate cache keys per tenant

### Row-Level Security (RLS)
```sql
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_policy
  ON companies FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

## Data Privacy & Security

### Encryption
- **Transit**: TLS 1.3 for all data in flight
- **Rest**: AES-256 encryption for sensitive data
- **Column-Level**: PII columns encrypted at column level
- **Key Rotation**: Automatic key rotation quarterly

### Access Control
- **RBAC**: Role-based access enforcement
- **Row-Level**: Organization-level isolation
- **Audit Logging**: All access logged
- **Data Masking**: PII masked for non-production

### Compliance
- **GDPR**: Data subject rights implementation
- **CCPA**: Data privacy controls
- **SOC 2**: Compliance controls
- **HIPAA**: If needed for healthcare clients

## Migration & Schema Versioning

### Migration Process
```
1. Plan: Design schema changes
2. Develop: Create migration scripts
3. Test: Test in staging environment
4. Schedule: Plan production deployment
5. Execute: Run migration in production
6. Verify: Validate data integrity
7. Monitor: Monitor for issues post-migration
```

### Backwards Compatibility
- Support at least 2 previous versions
- Deprecation warnings before removal
- Gradual migration of code

### Zero-Downtime Migrations
- Blue-green deployments
- Shadow traffic testing
- Gradual rollout strategies

## Data Archival & Purging

### Retention Policies
- **Audit Logs**: 7 years (compliance)
- **Financial Data**: 7 years (accounting)
- **Operational Data**: 3 years default
- **Temporary Data**: 30 days default

### Archival Process
- Cold storage for historical data
- Searchable archive structure
- Compliance-aware retention

## Performance Optimization

### Query Optimization
- EXPLAIN ANALYZE for all slow queries
- Index usage statistics monitoring
- Query plan optimization
- Materialized views for complex reports

### Connection Management
- PgBouncer for connection pooling
- Connection limits per application
- Idle connection timeout

### Maintenance
- Vacuum and analyze nightly
- Index fragmentation monitoring
- Statistics updates
- Autovacuum tuning

## Monitoring & Observability

### Metrics to Track
- Query performance (slow queries)
- Connection pool usage
- Replication lag
- Cache hit rates
- Disk space usage
- Transaction latency

### Tools
- pg_stat_statements for query analysis
- Prometheus for metrics collection
- Grafana for visualization
- PagerDuty for alerts

## Future Enhancements

- **Time Series Data**: InfluxDB for metrics
- **Graph Database**: Neo4j for relationship queries
- **Search Engine**: Elasticsearch for full-text search
- **Document Database**: MongoDB for unstructured data
- **Event Store**: Event sourcing for audit trails
