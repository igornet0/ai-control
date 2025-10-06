# AI Control System - Monitoring & Observability

This directory contains the monitoring and observability stack for the AI Control System, including health checks, metrics collection, alerting, and visualization.

## Architecture

The monitoring stack consists of:

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Jaeger**: Distributed tracing
- **ELK Stack**: Log aggregation and analysis
- **Custom Health Checks**: Application-specific monitoring

## Components

### Health Checks

The system includes comprehensive health checks for:

- **Database**: PostgreSQL connectivity and performance
- **DataCode Service**: External service availability
- **Memory**: System memory usage
- **Disk**: Disk space utilization
- **Custom Services**: Application-specific health indicators

### Metrics Collection

Application metrics include:

- **HTTP Metrics**: Request rate, response time, error rate
- **Business Metrics**: User registrations, task creation, KPI calculations
- **System Metrics**: Memory, CPU, disk usage
- **Database Metrics**: Connection pool, query performance
- **External Service Metrics**: DataCode execution time and success rate

### Alerting

Alert rules cover:

- **Critical Alerts**: Database down, service unavailable
- **Warning Alerts**: High resource usage, degraded performance
- **Info Alerts**: Business metrics, usage patterns

## Quick Start

### Start Monitoring Stack

```bash
# Start the full monitoring stack
make monitoring

# Or start individual components
docker-compose -f aic_docker/docker-compose.dev.yml -f aic_docker/docker-compose.monitoring.yml up -d
```

### Access Dashboards

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Jaeger**: http://localhost:16686
- **Kibana**: http://localhost:5601

### Stop Monitoring

```bash
make monitoring-down
```

## Configuration

### Prometheus

Configuration files:
- `prometheus.yml`: Main Prometheus configuration
- `alert_rules.yml`: Alert rules and thresholds

### Grafana

- `grafana/dashboards/`: Pre-configured dashboards
- `grafana/datasources/`: Data source configurations

### AlertManager

- `alertmanager.yml`: Alert routing and notification settings

## API Endpoints

### Health Checks

```bash
# Overall system health
GET /api/v1/monitoring/health

# Specific service health
GET /api/v1/monitoring/health?service=database

# Kubernetes probes
GET /api/v1/monitoring/health/live
GET /api/v1/monitoring/health/ready
```

### Metrics

```bash
# Application metrics
GET /api/v1/monitoring/metrics

# Prometheus format
GET /api/v1/monitoring/metrics/prometheus

# Specific metric
GET /api/v1/monitoring/metrics?name=http_request_duration_ms
```

### Alerts

```bash
# Active alerts
GET /api/v1/monitoring/alerts

# Alerts by severity
GET /api/v1/monitoring/alerts?severity=critical

# Acknowledge alert
POST /api/v1/monitoring/alerts/{alert_id}/acknowledge

# Resolve alert
POST /api/v1/monitoring/alerts/{alert_id}/resolve
```

### Dashboard

```bash
# Comprehensive monitoring data
GET /api/v1/monitoring/dashboard
```

## Custom Metrics

### Recording Metrics

```python
from src.infrastructure.monitoring.metrics import get_metrics_collector, get_business_metrics

# Get metrics collector
metrics = get_metrics_collector()

# Record custom metric
await metrics.record_histogram("custom_metric", 123.45, {"label": "value"})

# Business metrics
business_metrics = get_business_metrics()
await business_metrics.record_user_registration("user")
```

### HTTP Request Metrics

```python
from src.infrastructure.monitoring.metrics import get_metrics_middleware

# Use in FastAPI middleware
middleware = get_metrics_middleware()

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    async with middleware.measure_request(request.method, request.url.path):
        response = await call_next(request)
    return response
```

## Alert Rules

### Health Alerts

- **Database Down**: Critical alert when database is unavailable
- **High Memory Usage**: Warning when memory usage > 90%
- **High Disk Usage**: Warning when disk usage > 90%

### Application Alerts

- **High Error Rate**: Critical when HTTP error rate > 10%
- **High Response Time**: Warning when 95th percentile > 5s
- **Low Request Rate**: Warning when request rate < 0.1/s

### Business Alerts

- **High Task Creation**: Info when task creation rate > 10/min
- **Low User Activity**: Warning when login rate < 1/hour
- **DataCode Service Down**: Critical when service unavailable

## Dashboards

### System Overview

- System health status
- HTTP request metrics
- Response time trends
- Error rate monitoring

### Business Metrics

- User activity
- Task creation and completion
- KPI calculations
- Dashboard usage

### Infrastructure

- Database performance
- Cache metrics
- Message queue status
- System resources

## Webhooks

### AlertManager Integration

The system receives alerts from Prometheus/AlertManager:

```bash
POST /api/v1/webhooks/alertmanager
```

### GitHub Integration

For CI/CD pipeline monitoring:

```bash
POST /api/v1/webhooks/github
```

### Slack Integration

For team notifications:

```bash
POST /api/v1/webhooks/slack
```

## Troubleshooting

### Common Issues

1. **Prometheus not scraping metrics**
   - Check if backend is running
   - Verify metrics endpoint is accessible
   - Check Prometheus configuration

2. **Grafana dashboards not loading**
   - Verify Prometheus data source
   - Check dashboard JSON syntax
   - Ensure metrics are being collected

3. **Alerts not firing**
   - Check alert rules syntax
   - Verify metric names match
   - Check AlertManager configuration

### Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check alert rules
curl http://localhost:9090/api/v1/rules

# Check metrics
curl http://localhost:8000/api/v1/monitoring/metrics/prometheus

# Check health
curl http://localhost:8000/api/v1/monitoring/health
```

## Best Practices

### Metrics

1. **Use meaningful metric names**
2. **Add appropriate labels**
3. **Avoid high cardinality**
4. **Use appropriate metric types**

### Alerts

1. **Set appropriate thresholds**
2. **Use proper severity levels**
3. **Configure notification channels**
4. **Test alert rules**

### Dashboards

1. **Keep dashboards focused**
2. **Use appropriate time ranges**
3. **Include context and annotations**
4. **Regular review and updates**

## Production Considerations

### Scaling

- Use external Prometheus for production
- Consider Prometheus federation
- Use dedicated Grafana instance
- Implement proper backup strategies

### Security

- Secure Prometheus endpoints
- Use authentication for Grafana
- Encrypt alert notifications
- Implement proper RBAC

### Performance

- Monitor monitoring stack performance
- Use appropriate retention policies
- Optimize query performance
- Consider metric sampling

## Contributing

When adding new monitoring:

1. **Add health checks** for new services
2. **Define metrics** for business logic
3. **Create alert rules** for critical issues
4. **Update dashboards** with new metrics
5. **Test monitoring** in development
6. **Document changes** in this README
