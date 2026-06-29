# Build system for Feed Menu extension

APP_NAME = "Feed Menu"
BUNDLE_ID = "com.mnot.FeedMenu"
BUILD_DIR = build
FIREFOX_DIR = $(BUILD_DIR)/firefox
SAFARI_SRC = $(BUILD_DIR)/safari-src
SAFARI_DIR = $(BUILD_DIR)/safari

# Web-extension files shared by every target
EXT_FILES = icons background.js platform.js popup.js popup.html onboarding.html style.css

.PHONY: all safari firefox clean

all: safari firefox

safari: clean
	@echo "Staging Safari extension sources..."
	@mkdir -p $(SAFARI_SRC)
	@cp -R $(EXT_FILES) $(SAFARI_SRC)/
	@cp manifest.json $(SAFARI_SRC)/manifest.json
	@echo "Generating Safari project..."
	xcrun safari-web-extension-converter $(SAFARI_SRC) \
		--app-name $(APP_NAME) \
		--bundle-identifier $(BUNDLE_ID) \
		--project-location $(SAFARI_DIR) \
		--copy-resources \
		--no-open --no-prompt \
		--force

firefox:
	@echo "Packaging Firefox version..."
	@mkdir -p $(FIREFOX_DIR)
	@cp -R $(EXT_FILES) $(FIREFOX_DIR)/
	@cp manifest.firefox.json $(FIREFOX_DIR)/manifest.json
	@echo "Firefox build ready in $(FIREFOX_DIR)"

clean:
	@echo "Cleaning up build artifacts..."
	@rm -rf FeedMenu "Feed Menu"
	@rm -rf $(BUILD_DIR)
