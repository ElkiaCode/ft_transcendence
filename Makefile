PROJECT_NAME := transcendence
COMPOSE      := docker compose -p $(PROJECT_NAME)

CERT_DIR     := infra/nginx/certs
CERT_CRT     := $(CERT_DIR)/dev.crt
CERT_KEY     := $(CERT_DIR)/dev.key
WORKSPACE    := /workspace

all: up

cert:
	@if [ -f "$(CERT_CRT)" ] && [ -f "$(CERT_KEY)" ]; then \
		echo "HTTPS certificate already exists..."; \
	else \
		echo "Generating self-signed HTTPS certificate for localhost..."; \
		docker run --rm \
			-v "$(CURDIR):$(WORKSPACE)" \
			alpine:3.20 \
			sh -ec "apk add --no-cache openssl >/dev/null; \
				mkdir -p $(WORKSPACE)/$(CERT_DIR); \
				openssl req -x509 -newkey rsa:2048 -nodes \
					-keyout $(WORKSPACE)/$(CERT_KEY) \
					-out $(WORKSPACE)/$(CERT_CRT) \
					-days 365 \
					-subj /CN=localhost >/dev/null 2>&1"; \
		echo "HTTPS certificate created..."; \
	fi

up: cert
	@$(COMPOSE) up --build -d

down:
	@$(COMPOSE) down --remove-orphans

re: down up

build:
	@$(COMPOSE) build

logs:
	@$(COMPOSE) logs -f

ps:
	@$(COMPOSE) ps

clean:
	@$(COMPOSE) down --remove-orphans --rmi local

fclean:
	@echo "Removing containers, project images, volumes and all database data..."
	@$(COMPOSE) down --volumes --remove-orphans --rmi local
	@docker run --rm \
		-v "$(CURDIR):$(WORKSPACE)" \
		alpine:3.20 \
		sh -ec "rm -rf \
			$(WORKSPACE)/data/postgres_data \
			$(WORKSPACE)/data/uploads \
			$(WORKSPACE)/$(CERT_CRT) \
			$(WORKSPACE)/$(CERT_KEY)"
	@echo "Done."


.PHONY: all up down re build logs ps cert clean fclean
