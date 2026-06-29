# Build system for Feed Menu extension

APP_NAME = "Feed Menu"
BUNDLE_ID = "com.mnot.FeedMenu"
BUILD_DIR = build
FIREFOX_DIR = $(BUILD_DIR)/firefox
SAFARI_SRC = $(BUILD_DIR)/safari-src
SAFARI_DIR = $(BUILD_DIR)/safari

# Web-extension files shared by every target
EXT_FILES = icons background.js platform.js popup.js popup.html onboarding.html style.css

.PHONY: all safari safari-run firefox clean

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

# Regenerate the Xcode project, build it, and launch the container app — which
# registers/refreshes the Safari extension. Saves the manual open-Xcode-and-hit-
# Run step on each iteration. You still enable it once in Safari Settings ->
# Extensions, and (for unsigned dev builds) re-allow unsigned extensions after a
# Safari restart. Picks the macOS scheme automatically.
safari-run: safari
	@PROJ="$(SAFARI_DIR)/Feed Menu/Feed Menu.xcodeproj"; \
	SCHEME=$$(xcodebuild -project "$$PROJ" -list 2>/dev/null | awk '/Schemes:/{f=1;next} f&&NF{gsub(/^[ \t]+/,"");print}' | grep -i 'macos' | head -1); \
	[ -z "$$SCHEME" ] && SCHEME=$$(xcodebuild -project "$$PROJ" -list 2>/dev/null | awk '/Schemes:/{f=1;next} f&&NF{gsub(/^[ \t]+/,"");print; exit}'); \
	echo "Building scheme: $$SCHEME"; \
	xcodebuild -project "$$PROJ" -scheme "$$SCHEME" -configuration Debug -derivedDataPath "$(SAFARI_DIR)/DerivedData" build || exit 1; \
	APP=$$(/usr/bin/find "$(SAFARI_DIR)/DerivedData/Build/Products" -maxdepth 2 -name '*.app' -type d | head -1); \
	[ -z "$$APP" ] && { echo "Build succeeded but no .app found"; exit 1; }; \
	echo "Launching $$APP"; \
	open "$$APP"

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
