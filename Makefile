FRONTEND_DIR = frontend
BACKEND_DIR = backend
MODEL_DIR = simplifier_service

FRONTEND_CMD = cd $(FRONTEND_DIR) && npm start
BACKEND_CMD = cd $(BACKEND_DIR) && npm start
MODEL_CMD = cd $(MODEL_DIR) && python app.py

#colors for terminal output
BLUE = \033[0;34m
GREEN = \033[0;32m
RED = \033[0;31m
YELLOW = \033[0;33m
NC = \033[0m 


all: welcome start-all

welcome:
	@echo "$(GREEN)Starting Readable application...$(NC)"
	@echo "$(BLUE)Press Ctrl+C to stop all services$(NC)"

start-all:
	@echo "$(GREEN)Starting Backend, Model, and Frontend services...$(NC)"
	@$(MAKE) -j3 backend model frontend

frontend:
	@echo "$(BLUE)Starting Frontend service...$(NC)"
	@$(FRONTEND_CMD)

backend:
	@echo "$(BLUE)Starting Backend service...$(NC)"
	@$(BACKEND_CMD)

model:
	@echo "$(BLUE)Starting Model service...$(NC)"
	@$(MODEL_CMD)


check:
	@echo "$(BLUE)Checking if services are installed properly...$(NC)"
	@if [ -d "$(FRONTEND_DIR)/node_modules" ]; then \
		echo "$(GREEN)Frontend dependencies installed.$(NC)"; \
	else \
		echo "$(RED)Frontend dependencies missing. Run 'cd $(FRONTEND_DIR) && npm install'$(NC)"; \
	fi
	@if [ -d "$(BACKEND_DIR)/node_modules" ]; then \
		echo "$(GREEN)Backend dependencies installed.$(NC)"; \
	else \
		echo "$(RED)Backend dependencies missing. Run 'cd $(BACKEND_DIR) && npm install'$(NC)"; \
	fi
	@if command -v python >/dev/null 2>&1; then \
		echo "$(GREEN)Python is installed.$(NC)"; \
	else \
		echo "$(RED)Python is not installed. Please install Python.$(NC)"; \
	fi

install:
	@echo "$(BLUE)Installing dependencies for all services...$(NC)"
	@echo "$(YELLOW)Installing Frontend dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && npm install
	@echo "$(YELLOW)Installing Backend dependencies...$(NC)"
	@cd $(BACKEND_DIR) && npm install
	@echo "$(YELLOW)Checking for Python requirements...$(NC)"
	@if [ -f "$(MODEL_DIR)/requirements.txt" ]; then \
		pip install -r $(MODEL_DIR)/requirements.txt; \
	else \
		echo "$(YELLOW)No requirements.txt found for the model service.$(NC)"; \
	fi
	@echo "$(GREEN)All dependencies installed.$(NC)"

clean:
	@echo "$(BLUE)Cleaning temporary files...$(NC)"
	@find . -name "*.pyc" -delete
	@find . -name "__pycache__" -delete
	@echo "$(GREEN)Temporary files cleaned.$(NC)"

.PHONY: all welcome start-all frontend backend model check install clean
