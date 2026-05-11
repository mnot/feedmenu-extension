# Build system for Feed Menu extension

APP_NAME = "Feed Menu"
BUNDLE_ID = "com.mnot.FeedMenu"
BUILD_DIR = build
FIREFOX_DIR = $(BUILD_DIR)/firefox

.PHONY: all safari firefox clean

all: safari firefox

safari: clean
	@echo "Generating Safari project..."
	xcrun safari-web-extension-converter . \
		--app-name $(APP_NAME) \
		--bundle-identifier $(BUNDLE_ID) \
		--copy-resources \
		--no-open --no-prompt \
		--force

firefox:
	@echo "Packaging Firefox version..."
	@mkdir -p $(FIREFOX_DIR)
	@cp -R icons background.js popup.js popup.html onboarding.html style.css $(FIREFOX_DIR)/
	@cp manifest.firefox.json $(FIREFOX_DIR)/manifest.json
	@echo "Firefox build ready in $(FIREFOX_DIR)"

clean:
	@echo "Cleaning up build artifacts..."
	@rm -rf FeedMenu
	@rm -rf $(BUILD_DIR)
