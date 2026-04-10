PROJECT_NAME := transcendence
COMPOSE      := docker compose -p $(PROJECT_NAME)

CERT_DIR     := infra/nginx/certs
CERT_CRT     := $(CERT_DIR)/dev.crt
CERT_KEY     := $(CERT_DIR)/dev.key

all: up

cert:
	@mkdir -p $(CERT_DIR)
	@if [ -f "$(CERT_CRT)" ] && [ -f "$(CERT_KEY)" ]; then \
		echo "HTTPS certificate already exists..."; \
	else \
		echo "Generating self-signed HTTPS certificate for localhost..."; \
		openssl req -x509 -newkey rsa:2048 -nodes \
			-keyout "$(CERT_KEY)" \
			-out "$(CERT_CRT)" \
			-days 365 \
			-subj "/CN=localhost"; \
		echo "HTTPS certificate created..."; \
	fi

folder:
	@mkdir -p data/postgres_data
	@mkdir -p data/uploads

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
	@$(COMPOSE) down -v --remove-orphans
	@docker volume prune -f
	@docker system prune -f --volumes

fclean: clean
	@echo "Removing dev certificates and postgres database"
	@rm -f "$(CERT_CRT)" "$(CERT_KEY)"
	@sudo rm -rf ./data/postgres_data
	@echo "Done."


.PHONY: all up down re build logs ps cert clean fclean help