/**
 * アクセスログの形式の定義。
 *
 * 読み取りの本体は pattern.js、集計は stats.js にある。このファイルは
 * どの形式をどの順番で試すか、どんな項目を持つかの表だけを持つ。
 */

export const LOG_FORMATS = {
  "apache-common": {
    id: "apache-common",
    label: "Apache common",
    fields: ["ip", "ident", "user", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "apache-combined": {
    id: "apache-combined",
    label: "Apache combined",
    fields: ["ip", "ident", "user", "time", "request", "status", "bytes", "referer", "agent"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "apache-vhost": {
    id: "apache-vhost",
    label: "Apache vhost",
    fields: ["vhost", "ip", "ident", "user", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "nginx-combined": {
    id: "nginx-combined",
    label: "nginx combined",
    fields: ["ip", "ident", "user", "time", "request", "status", "bytes", "referer", "agent"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "nginx-json": {
    id: "nginx-json",
    label: "nginx JSON",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "iis-w3c": {
    id: "iis-w3c",
    label: "IIS W3C",
    fields: ["date", "time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "yyyy-MM-dd HH:mm:ss",
    ipVersion: 4,
    supportsIPv6: false,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "caddy-json": {
    id: "caddy-json",
    label: "Caddy JSON",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "traefik-common": {
    id: "traefik-common",
    label: "Traefik common",
    fields: ["ip", "ident", "user", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "haproxy-http": {
    id: "haproxy-http",
    label: "HAProxy HTTP",
    fields: ["ip", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss.SSS",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "envoy-text": {
    id: "envoy-text",
    label: "Envoy text",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "cloudfront": {
    id: "cloudfront",
    label: "CloudFront",
    fields: ["date", "time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "yyyy-MM-dd HH:mm:ss",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "cloudflare": {
    id: "cloudflare",
    label: "Cloudflare",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "fastly": {
    id: "fastly",
    label: "Fastly",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "akamai": {
    id: "akamai",
    label: "Akamai",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "squid": {
    id: "squid",
    label: "Squid",
    fields: ["time", "elapsed", "ip", "status", "bytes", "method", "path"],
    timeFormat: "epoch",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "varnish": {
    id: "varnish",
    label: "Varnish",
    fields: ["ip", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "lighttpd": {
    id: "lighttpd",
    label: "lighttpd",
    fields: ["ip", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "caddy-common": {
    id: "caddy-common",
    label: "Caddy common",
    fields: ["ip", "user", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "node-morgan": {
    id: "node-morgan",
    label: "Node morgan",
    fields: ["ip", "time", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "express-winston": {
    id: "express-winston",
    label: "Express winston",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "rails": {
    id: "rails",
    label: "Rails",
    fields: ["time", "method", "path", "status", "bytes", "ip"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "django": {
    id: "django",
    label: "Django",
    fields: ["time", "method", "path", "status", "bytes", "ip"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "gunicorn": {
    id: "gunicorn",
    label: "Gunicorn",
    fields: ["ip", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "uvicorn": {
    id: "uvicorn",
    label: "Uvicorn",
    fields: ["ip", "time", "method", "path", "status"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "tomcat": {
    id: "tomcat",
    label: "Tomcat",
    fields: ["ip", "time", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "jetty": {
    id: "jetty",
    label: "Jetty",
    fields: ["ip", "time", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "kestrel": {
    id: "kestrel",
    label: "Kestrel",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "go-http": {
    id: "go-http",
    label: "Go net/http",
    fields: ["ip", "time", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "go-zerolog": {
    id: "go-zerolog",
    label: "Go zerolog",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "rust-actix": {
    id: "rust-actix",
    label: "Rust actix",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "rust-warp": {
    id: "rust-warp",
    label: "Rust warp",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "elixir-plug": {
    id: "elixir-plug",
    label: "Elixir Plug",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "erlang-cowboy": {
    id: "erlang-cowboy",
    label: "Erlang Cowboy",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "php-fpm": {
    id: "php-fpm",
    label: "PHP-FPM",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "litespeed": {
    id: "litespeed",
    label: "LiteSpeed",
    fields: ["ip", "time", "request", "status", "bytes", "agent"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "openresty": {
    id: "openresty",
    label: "OpenResty",
    fields: ["ip", "time", "request", "status", "bytes", "agent"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "haproxy-tcp": {
    id: "haproxy-tcp",
    label: "HAProxy TCP",
    fields: ["ip", "time", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss.SSS",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "aws-alb": {
    id: "aws-alb",
    label: "AWS ALB",
    fields: ["time", "elb", "ip", "status", "bytes", "request"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "aws-elb": {
    id: "aws-elb",
    label: "AWS ELB",
    fields: ["time", "elb", "ip", "status", "bytes", "request"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "gcp-lb": {
    id: "gcp-lb",
    label: "Google Cloud LB",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "azure-app": {
    id: "azure-app",
    label: "Azure App Service",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "heroku-router": {
    id: "heroku-router",
    label: "Heroku router",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "fly-io": {
    id: "fly-io",
    label: "Fly.io",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "vercel": {
    id: "vercel",
    label: "Vercel",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "netlify": {
    id: "netlify",
    label: "Netlify",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "github-pages": {
    id: "github-pages",
    label: "GitHub Pages",
    fields: ["ip", "time", "request", "status", "bytes"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "s3-access": {
    id: "s3-access",
    label: "Amazon S3 access",
    fields: ["time", "ip", "request", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "minio": {
    id: "minio",
    label: "MinIO",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "kong": {
    id: "kong",
    label: "Kong",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "tyk": {
    id: "tyk",
    label: "Tyk",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "istio": {
    id: "istio",
    label: "Istio",
    fields: ["time", "ip", "method", "path", "status", "bytes", "agent"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "linkerd": {
    id: "linkerd",
    label: "Linkerd",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "fluentd": {
    id: "fluentd",
    label: "Fluentd",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "logstash": {
    id: "logstash",
    label: "Logstash",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "filebeat": {
    id: "filebeat",
    label: "Filebeat",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "vector": {
    id: "vector",
    label: "Vector",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "graylog": {
    id: "graylog",
    label: "Graylog",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "splunk": {
    id: "splunk",
    label: "Splunk",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "datadog": {
    id: "datadog",
    label: "Datadog",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "newrelic": {
    id: "newrelic",
    label: "New Relic",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "sentry": {
    id: "sentry",
    label: "Sentry",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "elastic-apm": {
    id: "elastic-apm",
    label: "Elastic APM",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "grafana": {
    id: "grafana",
    label: "Grafana",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "prometheus": {
    id: "prometheus",
    label: "Prometheus",
    fields: ["time", "ip", "method", "path", "status"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "zabbix": {
    id: "zabbix",
    label: "Zabbix",
    fields: ["time", "ip", "method", "path", "status"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "nagios": {
    id: "nagios",
    label: "Nagios",
    fields: ["time", "ip", "method", "path", "status"],
    timeFormat: "dd/MMM/yyyy:HH:mm:ss Z",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "munin": {
    id: "munin",
    label: "Munin",
    fields: ["time", "ip", "method", "path", "status"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "collectd": {
    id: "collectd",
    label: "collectd",
    fields: ["time", "ip", "method", "path", "status"],
    timeFormat: "epoch",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "telegraf": {
    id: "telegraf",
    label: "Telegraf",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "influxdb": {
    id: "influxdb",
    label: "InfluxDB",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "clickhouse": {
    id: "clickhouse",
    label: "ClickHouse",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "kafka": {
    id: "kafka",
    label: "Kafka",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "epoch",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "rabbitmq": {
    id: "rabbitmq",
    label: "RabbitMQ",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "redis": {
    id: "redis",
    label: "Redis",
    fields: ["time", "ip", "method", "path", "status"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "postgres": {
    id: "postgres",
    label: "PostgreSQL",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "mysql": {
    id: "mysql",
    label: "MySQL",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "yyyy-MM-dd HH:mm:ss",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "mariadb": {
    id: "mariadb",
    label: "MariaDB",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "yyyy-MM-dd HH:mm:ss",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "mongodb": {
    id: "mongodb",
    label: "MongoDB",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "elasticsearch": {
    id: "elasticsearch",
    label: "Elasticsearch",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "opensearch": {
    id: "opensearch",
    label: "OpenSearch",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "solr": {
    id: "solr",
    label: "Solr",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: false,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "couchdb": {
    id: "couchdb",
    label: "CouchDB",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "neo4j": {
    id: "neo4j",
    label: "Neo4j",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "ISO8601",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
  "minio-gateway": {
    id: "minio-gateway",
    label: "MinIO gateway",
    fields: ["time", "ip", "method", "path", "status", "bytes"],
    timeFormat: "RFC3339",
    ipVersion: 4,
    supportsIPv6: true,
    json: true,
    quote: '"',
    separator: " ",
    timezone: "UTC",
    enabled: true,
  },
};

/**
 * 形式 ID から定義を取り出す。
 * @param {string} id
 * @returns {object}
 */
export function getFormat(id) {
  const format = LOG_FORMATS[String(id)];
  if (!format) {
    throw new RangeError(`unknown log format: ${id}`);
  }
  return format;
}

/**
 * 定義済みの形式 ID を返す。
 * @returns {string[]}
 */
export function formatIds() {
  return Object.keys(LOG_FORMATS).sort();
}

/**
 * 画面用の形式一覧を返す。
 * @returns {{id: string, label: string}[]}
 */
export function formatOptions() {
  return formatIds().map((id) => ({ id, label: LOG_FORMATS[id].label }));
}

/**
 * その形式が IPv6 を受け付けるかを返す。
 * @param {string} id
 * @returns {boolean}
 */
export function supportsIPv6(id) {
  return getFormat(id).supportsIPv6 === true;
}

/**
 * JSON 形式かを返す。
 * @param {string} id
 * @returns {boolean}
 */
export function isJsonFormat(id) {
  return getFormat(id).json === true;
}

/**
 * 形式の項目一覧を返す。
 * @param {string} id
 * @returns {string[]}
 */
export function fieldsOf(id) {
  return [...getFormat(id).fields];
}

/**
 * 形式の時刻書式を返す。
 * @param {string} id
 * @returns {string}
 */
export function timeFormatOf(id) {
  return getFormat(id).timeFormat;
}

/**
 * 使用可能な形式だけを返す。
 * @returns {object[]}
 */
export function enabledFormats() {
  return formatIds()
    .map((id) => LOG_FORMATS[id])
    .filter((format) => format.enabled);
}

/**
 * 項目名から形式を探す。
 * @param {string} field
 * @returns {string[]}
 */
export function formatsWithField(field) {
  return formatIds().filter((id) => LOG_FORMATS[id].fields.includes(field));
}

/**
 * IPv6 を受け付ける形式を返す。
 * @returns {string[]}
 */
export function ipv6Formats() {
  return formatIds().filter((id) => supportsIPv6(id));
}

/**
 * JSON 形式の一覧を返す。
 * @returns {string[]}
 */
export function jsonFormats() {
  return formatIds().filter((id) => isJsonFormat(id));
}

/**
 * 形式 ID が定義済みかを返す。
 * @param {string} id
 * @returns {boolean}
 */
export function hasFormat(id) {
  return Object.hasOwn(LOG_FORMATS, String(id));
}

/**
 * 形式を検証する。
 * @param {string} id
 * @returns {string[]}
 */
export function validateFormat(id) {
  const format = LOG_FORMATS[String(id)];
  if (!format) {
    return ["not found"];
  }
  const problems = [];
  if (format.fields.length === 0) problems.push("fields must not be empty");
  if (format.ipVersion !== 4 && format.ipVersion !== 6) problems.push("ipVersion must be 4 or 6");
  if (typeof format.supportsIPv6 !== "boolean") problems.push("supportsIPv6 must be boolean");
  if (format.separator.length === 0) problems.push("separator must not be empty");
  return problems;
}

/**
 * すべての形式を検証する。
 * @returns {{id: string, problems: string[]}[]}
 */
export function validateAllFormats() {
  return formatIds()
    .map((id) => ({ id, problems: validateFormat(id) }))
    .filter((entry) => entry.problems.length > 0);
}

/**
 * 時刻書式ごとの形式をまとめる。
 * @returns {Record<string, string[]>}
 */
export function formatsByTimeFormat() {
  const groups = {};
  for (const id of formatIds()) {
    const key = timeFormatOf(id);
    groups[key] = groups[key] ?? [];
    groups[key].push(id);
  }
  return groups;
}

/**
 * 項目数ごとの形式をまとめる。
 * @returns {Record<string, string[]>}
 */
export function formatsByFieldCount() {
  const groups = {};
  for (const id of formatIds()) {
    const key = String(fieldsOf(id).length);
    groups[key] = groups[key] ?? [];
    groups[key].push(id);
  }
  return groups;
}
