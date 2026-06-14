# Folder Structure - Inlight Agency OS

## Enterprise-Grade Project Organization

This folder structure is designed for a large, distributed team working on a complex, microservices-based AI operating system. It emphasizes clarity, modularity, independence, and scalability.

```
inlight-agency-os/
│
├── docs/                                  # Project documentation
│   ├── vision.md                          # Strategic vision and roadmap
│   ├── system-architecture.md             # System design and patterns
│   ├── folder-structure.md                # This file
│   ├── database-architecture.md           # Data model and schema
│   ├── agent-architecture.md              # AI agent systems design
│   ├── development-roadmap.md             # Development phases and timeline
│   ├── api/                               # API documentation
│   │   ├── overview.md                    # API overview and versioning
│   │   ├── authentication.md              # Auth & security protocols
│   │   ├── services/                      # Service-specific API docs
│   │   │   ├── crm-api.md
│   │   │   ├── project-api.md
│   │   │   ├── financial-api.md
│   │   │   ├── sales-api.md
│   │   │   ├── marketing-api.md
│   │   │   ├── content-api.md
│   │   │   ├── resource-api.md
│   │   │   ├── workflow-api.md
│   │   │   ├── analytics-api.md
│   │   │   └── integration-api.md
│   │   └── webhooks.md                    # Webhook documentation
│   ├── user-guides/                       # User documentation
│   │   ├── getting-started.md
│   │   ├── crm-guide.md
│   │   ├── project-management.md
│   │   ├── financial-operations.md
│   │   ├── sales-operations.md
│   │   ├── marketing-operations.md
│   │   └── client-portal-guide.md
│   ├── architecture/                      # Detailed architecture docs
│   │   ├── company-brain.md               # Company intelligence system
│   │   ├── agent-system.md                # Multi-agent orchestration
│   │   ├── knowledge-base.md              # Knowledge management
│   │   ├── data-flow.md                   # System data flows
│   │   ├── security-architecture.md       # Security design
│   │   └── deployment-architecture.md     # Deployment patterns
│   ├── operations/                        # Operations documentation
│   │   ├── deployment-guide.md            # Deployment procedures
│   │   ├── monitoring-guide.md            # Monitoring and alerts
│   │   ├── backup-recovery.md             # Backup and recovery
│   │   ├── scaling-guide.md               # Scaling procedures
│   │   ├── incident-response.md           # Incident management
│   │   └── maintenance-schedule.md        # Regular maintenance
│   └── decisions/                         # Architecture decision records
│       ├── adr-001-microservices.md
│       ├── adr-002-agent-architecture.md
│       └── ...
│
├── backend/                               # Backend services (monorepo for services)
│   ├── README.md                          # Backend overview
│   ├── package.json                       # Root dependencies
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── docker-compose.yml                 # Local development stack
│   ├── .env.example                       # Environment template
│   │
│   ├── shared/                            # Shared libraries and utilities
│   │   ├── packages/
│   │   │   ├── core/                      # Core utilities
│   │   │   │   ├── src/
│   │   │   │   │   ├── types/             # Shared types and interfaces
│   │   │   │   │   ├── constants/         # Shared constants
│   │   │   │   │   ├── utils/             # Utility functions
│   │   │   │   │   └── errors/            # Custom error classes
│   │   │   │   ├── tests/
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── database/                  # Database layer
│   │   │   │   ├── src/
│   │   │   │   │   ├── migrations/        # Database migrations
│   │   │   │   │   ├── seeders/           # Database seeders
│   │   │   │   │   ├── schema.prisma      # Prisma schema
│   │   │   │   │   └── client.ts          # Database client
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── auth/                      # Authentication library
│   │   │   │   ├── src/
│   │   │   │   │   ├── jwt/               # JWT utilities
│   │   │   │   │   ├── oauth/             # OAuth providers
│   │   │   │   │   ├── middleware/        # Auth middleware
│   │   │   │   │   └── types.ts           # Auth types
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── ai/                        # AI/ML utilities
│   │   │   │   ├── src/
│   │   │   │   │   ├── embeddings/        # Embedding models
│   │   │   │   │   ├── models/            # ML models
│   │   │   │   │   ├── prompts/           # LLM prompts
│   │   │   │   │   └── inference/         # Model inference
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── agents/                    # Agent framework
│   │   │   │   ├── src/
│   │   │   │   │   ├── base/              # Base agent classes
│   │   │   │   │   ├── orchestration/     # Agent orchestration
│   │   │   │   │   ├── communication/     # Inter-agent communication
│   │   │   │   │   ├── governance/        # Agent governance
│   │   │   │   │   └── templates/         # Agent templates
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── cache/                     # Caching utilities
│   │   │   │   ├── src/
│   │   │   │   │   ├── redis/
│   │   │   │   │   ├── strategies/
│   │   │   │   │   └── decorators/
│   │   │   │   └── package.json
│   │   │   │
│   │   │   ├── logging/                   # Logging utilities
│   │   │   │   ├── src/
│   │   │   │   │   ├── logger.ts
│   │   │   │   │   ├── formatters/
│   │   │   │   │   └── transports/
│   │   │   │   └── package.json
│   │   │   │
│   │   │   └── testing/                   # Testing utilities
│   │   │       ├── src/
│   │   │       │   ├── fixtures/
│   │   │       │   ├── mocks/
│   │   │       │   └── helpers/
│   │   │       └── package.json
│   │   │
│   │   └── types/                         # Monorepo types
│   │       ├── api.ts
│   │       ├── database.ts
│   │       └── index.ts
│   │
│   ├── services/                          # Microservices
│   │   │
│   │   ├── crm/                           # CRM Service (Company Brain)
│   │   │   ├── src/
│   │   │   │   ├── controllers/           # API controllers
│   │   │   │   ├── services/              # Business logic
│   │   │   │   ├── repositories/          # Data access
│   │   │   │   ├── entities/              # Domain models
│   │   │   │   ├── middleware/
│   │   │   │   ├── routes/
│   │   │   │   ├── agents/                # CRM-specific agents
│   │   │   │   ├── intelligence/          # CRM intelligence
│   │   │   │   └── index.ts               # Service entry
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── project/                       # Project Service (Delivery Brain)
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── middleware/
│   │   │   │   ├── routes/
│   │   │   │   ├── agents/
│   │   │   │   ├── intelligence/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── financial/                     # Financial Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── calculations/          # Financial calculations
│   │   │   │   ├── agents/
│   │   │   │   ├── intelligence/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── sales/                         # Sales Service (Pipeline Brain)
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── agents/
│   │   │   │   ├── intelligence/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── marketing/                     # Marketing Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── content/                       # Content Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── resource/                      # Resource Service (Talent Brain)
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── agents/
│   │   │   │   ├── intelligence/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── knowledge/                     # Knowledge Base Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── search/                # Vector search
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── workflow/                      # Workflow Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── engine/                # Workflow engine
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── analytics/                     # Analytics Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── metrics/               # Metric calculation
│   │   │   │   ├── reports/               # Report generation
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── collaboration/                 # Collaboration Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── messaging/             # Messaging system
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── integration/                   # Integration Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── connectors/            # Third-party connectors
│   │   │   │   ├── sync/                  # Data sync engine
│   │   │   │   ├── agents/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   ├── auth/                          # Auth Service
│   │   │   ├── src/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── repositories/
│   │   │   │   ├── entities/
│   │   │   │   ├── strategies/
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   │
│   │   └── api-gateway/                   # API Gateway Service
│   │       ├── src/
│   │       │   ├── routes/
│   │       │   ├── middleware/
│   │       │   ├── validators/
│   │       │   └── index.ts
│   │       ├── tests/
│   │       ├── Dockerfile
│   │       ├── package.json
│   │       └── README.md
│   │
│   ├── agents/                            # Agent implementations (separate from services)
│   │   ├── operational/
│   │   │   ├── project-coordinator/
│   │   │   ├── sales-pipeline/
│   │   │   ├── finance/
│   │   │   ├── resource-optimizer/
│   │   │   ├── quality-assurance/
│   │   │   └── workflow-executor/
│   │   │
│   │   ├── intelligence/
│   │   │   ├── client-intelligence/
│   │   │   ├── market-intelligence/
│   │   │   ├── performance-analytics/
│   │   │   ├── predictive/
│   │   │   └── learning/
│   │   │
│   │   ├── collaboration/
│   │   │   ├── notification-manager/
│   │   │   ├── meeting-coordinator/
│   │   │   ├── team-communicator/
│   │   │   └── client-engagement/
│   │   │
│   │   ├── integration/
│   │   │   ├── data-sync/
│   │   │   ├── api-integration/
│   │   │   ├── webhook-manager/
│   │   │   └── auth-manager/
│   │   │
│   │   ├── learning/
│   │   │   ├── feedback-analyzer/
│   │   │   ├── ab-test-orchestrator/
│   │   │   ├── cost-optimizer/
│   │   │   ├── performance-tuner/
│   │   │   └── continuous-improvement/
│   │   │
│   │   └── framework/                     # Shared agent framework
│   │       ├── orchestrator.ts
│   │       ├── coordinator.ts
│   │       └── templates/
│   │
│   └── infrastructure/                    # Infrastructure & DevOps
│       ├── kubernetes/                    # K8s manifests
│       │   ├── base/
│       │   │   ├── namespace.yaml
│       │   │   ├── rbac.yaml
│       │   │   └── storage.yaml
│       │   ├── services/                  # Service deployments
│       │   │   ├── crm-deployment.yaml
│       │   │   ├── project-deployment.yaml
│       │   │   └── ...
│       │   ├── agents/                    # Agent deployments
│       │   └── kustomization.yaml
│       │
│       ├── terraform/                     # Infrastructure as Code
│       │   ├── modules/
│       │   │   ├── networking/
│       │   │   ├── compute/
│       │   │   ├── database/
│       │   │   └── storage/
│       │   ├── environments/
│       │   │   ├── dev/
│       │   │   ├── staging/
│       │   │   └── production/
│       │   └── main.tf
│       │
│       ├── docker/                        # Docker configurations
│       │   ├── base.Dockerfile            # Base image
│       │   ├── node.Dockerfile
│       │   └── python.Dockerfile
│       │
│       ├── ci-cd/                         # CI/CD pipelines
│       │   ├── .gitlab-ci.yml
│       │   ├── github-workflows/
│       │   └── scripts/
│       │
│       ├── monitoring/                    # Monitoring setup
│       │   ├── prometheus/
│       │   ├── grafana/
│       │   ├── alerting/
│       │   └── dashboards/
│       │
│       ├── logging/                       # Logging setup
│       │   ├── elasticsearch/
│       │   ├── logstash/
│       │   └── kibana/
│       │
│       └── backup/                        # Backup configuration
│           ├── backup-scripts/
│           └── recovery-scripts/
│
├── frontend/                              # Frontend applications
│   ├── web/                               # Web application
│   │   ├── src/
│   │   │   ├── pages/                     # Route pages
│   │   │   │   ├── crm/
│   │   │   │   ├── projects/
│   │   │   │   ├── financial/
│   │   │   │   ├── sales/
│   │   │   │   ├── marketing/
│   │   │   │   ├── content/
│   │   │   │   ├── resources/
│   │   │   │   ├── analytics/
│   │   │   │   ├── collaboration/
│   │   │   │   └── admin/
│   │   │   ├── components/                # Reusable components
│   │   │   │   ├── common/
│   │   │   │   ├── layouts/
│   │   │   │   ├── forms/
│   │   │   │   └── charts/
│   │   │   ├── stores/                    # State management
│   │   │   │   ├── modules/
│   │   │   │   └── actions/
│   │   │   ├── services/                  # API clients
│   │   │   ├── hooks/                     # Custom hooks
│   │   │   ├── utils/                     # Utilities
│   │   │   ├── styles/                    # Global styles
│   │   │   └── App.tsx
│   │   ├── public/                        # Static assets
│   │   ├── tests/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── client-portal/                     # Client Portal
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── projects/
│   │   │   │   ├── communications/
│   │   │   │   └── reports/
│   │   │   ├── components/
│   │   │   ├── stores/
│   │   │   ├── services/
│   │   │   └── App.tsx
│   │   ├── tests/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── mobile/                            # Mobile application
│   │   ├── ios/                           # iOS (React Native or Swift)
│   │   ├── android/                       # Android (Kotlin)
│   │   └── shared/                        # Shared code
│   │
│   └── shared-ui/                         # Shared UI components library
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── styles/
│       │   └── index.ts
│       ├── tests/
│       ├── package.json
│       └── storybook/
│
├── ml/                                    # Machine Learning
│   ├── models/                            # ML models
│   │   ├── client-churn/                  # Churn prediction model
│   │   ├── revenue-forecast/              # Revenue forecasting
│   │   ├── resource-allocation/           # Resource optimization
│   │   ├── text-classification/           # Text classification
│   │   ├── recommendation/                # Recommendation engine
│   │   └── anomaly-detection/             # Anomaly detection
│   │
│   ├── training/                          # Model training
│   │   ├── datasets/                      # Training datasets
│   │   ├── notebooks/                     # Jupyter notebooks
│   │   ├── scripts/
│   │   ├── requirements.txt
│   │   └── config.yaml
│   │
│   ├── inference/                         # Model serving
│   │   ├── server/                        # Inference server
│   │   ├── clients/                       # Client libraries
│   │   └── config/
│   │
│   └── evaluation/                        # Model evaluation
│       ├── metrics/
│       ├── benchmarks/
│       └── reports/
│
├── scripts/                               # Utility scripts
│   ├── setup.sh                           # Setup script
│   ├── dev.sh                             # Development startup
│   ├── test.sh                            # Testing script
│   ├── deploy.sh                          # Deployment script
│   ├── migrate.sh                         # Database migration
│   └── backup.sh                          # Backup script
│
├── tests/                                 # Test suite
│   ├── unit/                              # Unit tests
│   ├── integration/                       # Integration tests
│   ├── e2e/                               # End-to-end tests
│   ├── performance/                       # Performance tests
│   ├── security/                          # Security tests
│   └── fixtures/                          # Test fixtures
│
├── config/                                # Configuration
│   ├── development.yaml                   # Dev configuration
│   ├── staging.yaml                       # Staging configuration
│   ├── production.yaml                    # Production configuration
│   ├── logging.yaml                       # Logging config
│   └── monitoring.yaml                    # Monitoring config
│
├── .github/                               # GitHub specific
│   ├── workflows/                         # GitHub Actions
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE/
│
├── .gitlab/                               # GitLab specific
│   ├── .gitlab-ci.yml
│   └── templates/
│
├── env/                                   # Environment configs
│   ├── .env.development
│   ├── .env.staging
│   ├── .env.production
│   └── .env.example
│
├── README.md                              # Project overview
├── CONTRIBUTING.md                        # Contribution guidelines
├── CODE_OF_CONDUCT.md                     # Code of conduct
├── LICENSE                                # License
├── Makefile                               # Make targets
└── docker-compose.yml                     # Local development stack
```

## Key Organizational Principles

### 1. Modularity
- Each service is independently deployable
- Services have minimal dependencies
- Shared libraries are versioned and released separately
- Clear API boundaries between modules

### 2. Scalability
- Horizontal scaling through Kubernetes
- Database read replicas for reporting
- Service replication for high availability
- Caching layer for performance

### 3. Clarity
- Clear naming conventions
- Organized by domain/responsibility
- Documentation co-located with code
- Architecture decision records

### 4. Separation of Concerns
- Services own their data
- Agents are separate from services
- Infrastructure code separate from application code
- Configuration separate from code

### 5. Developer Experience
- Local development stack with docker-compose
- Clear setup instructions
- Consistent tooling and patterns
- Comprehensive documentation

## Development Workflow

### Backend Development
```bash
cd backend
npm install
docker-compose up -d
npm run dev
```

### Frontend Development
```bash
cd frontend/web
npm install
npm run dev
```

### Agent Development
```bash
cd backend/agents
npm install
npm run dev
```

### Testing
```bash
npm run test              # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests
```

### Deployment
```bash
# Infrastructure provisioning
cd backend/infrastructure/terraform
terraform plan
terraform apply

# Kubernetes deployment
kubectl apply -k backend/infrastructure/kubernetes
```

## Service Dependencies

```
API Gateway → [All Services]
Auth Service ← [All Services]
CRM Service → Database, Cache
Project Service → CRM, Resource, Financial, Database
Financial Service → Project, Database
Sales Service → CRM, Project, Database
Marketing Service → Content, Database
Content Service → Knowledge, Database
Resource Service → Database, Cache
Workflow Service → [All Services], Message Queue
Analytics Service → Database, Data Warehouse
Collaboration Service → Database, Cache
Integration Service → [All Services], External APIs
Knowledge Service → Vector Store, Database
Agent Framework → [All Services]
```

## Monitoring & Observability Paths

```
Application Logs → ELK Stack → Kibana
Metrics → Prometheus → Grafana
Traces → Jaeger → UI
Alerts → PagerDuty
```

This structure supports a team of 50-100+ developers working simultaneously while maintaining code quality, scalability, and clarity.
