UUID       := spotify-ext@ikram
NAME       := sonora
DIST       := dist
SCHEMA_DIR := schemas
SOURCES    := extension.js prefs.js src

.PHONY: all help schemas lint test pack install uninstall nested clean

all: lint test schemas

help:
	@echo "Sonora - available targets"
	@echo ""
	@echo "  make schemas    Compile the GSettings schema (required before first run)"
	@echo "  make lint       Parse-check every JavaScript file"
	@echo "  make test       Run the unit tests"
	@echo "  make pack       Build $(DIST)/$(NAME).zip for release"
	@echo "  make install    Symlink into the extensions dir and compile the schema"
	@echo "  make uninstall  Remove the symlink"
	@echo "  make nested     Run a nested shell with the fake Spotify player"
	@echo "  make clean      Remove build output"

schemas:
	glib-compile-schemas $(SCHEMA_DIR)

lint:
	@set -e; for f in $$(find . -name '*.js' -not -path './node_modules/*' \
		-not -path './$(DIST)/*'); do \
		cp "$$f" /tmp/sonora-check.mjs; \
		node --check /tmp/sonora-check.mjs || { echo "syntax error: $$f"; exit 1; }; \
	done; \
	rm -f /tmp/sonora-check.mjs; \
	echo "lint ok"

test: 
	gjs -m tests/run.js

pack: 
	@rm -rf $(DIST) && mkdir -p $(DIST)/$(UUID)
	@cp metadata.json extension.js prefs.js stylesheet.css README.md $(DIST)/$(UUID)/
	@cp -r $(SOURCES) icons $(SCHEMA_DIR) $(DIST)/$(UUID)/
	@rm -f $(DIST)/$(UUID)/$(SCHEMA_DIR)/gschemas.compiled
	@cd $(DIST) && zip -qr $(NAME).zip $(UUID)
	@echo "built $(DIST)/$(NAME).zip"

install: schemas
	@mkdir -p ~/.local/share/gnome-shell/extensions
	@rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)
	@ln -s "$(CURDIR)" ~/.local/share/gnome-shell/extensions/$(UUID)
	@echo "linked $(UUID) -> $(CURDIR)"
	@echo "log out and back in, then: gnome-extensions enable $(UUID)"

uninstall:
	@rm -f ~/.local/share/gnome-shell/extensions/$(UUID)
	@echo "removed $(UUID)"

nested: schemas
	@dbus-run-session -- bash -c './dev/fake-spotify.js & gnome-shell --nested --wayland'

clean:
	@rm -rf $(DIST)
	@rm -f $(SCHEMA_DIR)/gschemas.compiled
	@echo "clean"
