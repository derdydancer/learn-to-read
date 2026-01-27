#!/bin/bash

# Script to create a VoltBuilder compatible zip
# Includes only the necessary files for Cordova build

set -e

PROJECT_NAME="learn-to-read"
BUILD_TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
ZIP_NAME="${PROJECT_NAME}-voltbuilder-$(date +%Y%m%d-%H%M%S).zip"
TEMP_DIR="temp-voltbuilder"

echo "Creating VoltBuilder compatible zip..."
echo "Build timestamp: ${BUILD_TIMESTAMP}"

# Check if www directory exists
if [ ! -d "www" ]; then
    echo "❌ Error: 'www' directory not found. Please build the project first."
    echo "Run: npm run build"
    exit 1
fi

# Check if config.xml exists
if [ ! -f "config.xml" ]; then
    echo "❌ Error: 'config.xml' not found. This is required for Cordova builds."
    exit 1
fi

# Create temporary directory
mkdir -p "${TEMP_DIR}"

echo "Copying VoltBuilder required files..."

# Copy essential files for Cordova build
cp config.xml "${TEMP_DIR}/"
cp -r www "${TEMP_DIR}/"
cp -r res "${TEMP_DIR}/" 2>/dev/null || echo "Note: 'res' directory not found (optional)"

# Copy any other VoltBuilder specific configs
if [ -f "voltbuilder.json" ]; then
    cp voltbuilder.json "${TEMP_DIR}/"
fi

if [ -f "metadata.json" ]; then
    cp metadata.json "${TEMP_DIR}/"
fi

# Add build timestamp watermark to the HTML
echo "Adding build timestamp watermark..."
HTML_FILE="${TEMP_DIR}/www/index.html"
if [ -f "$HTML_FILE" ]; then
    # Create a backup
    cp "$HTML_FILE" "${HTML_FILE}.bak"

    # Add timestamp as a meta tag
    TIMESTAMP_META="<meta name=\"build-timestamp\" content=\"${BUILD_TIMESTAMP}\">"

    # Use awk to insert timestamp meta tag after title
    awk -v timestamp="${TIMESTAMP_META}" '/<title>.*<\/title>/ {print $0 "\n    " timestamp; next} 1' "$HTML_FILE" > "${HTML_FILE}.tmp" && mv "${HTML_FILE}.tmp" "$HTML_FILE"

    # Create the watermark injection using a simpler approach
    # Append to the end of the file before </body>
    head -n -2 "$HTML_FILE" > "${HTML_FILE}.tmp"
    cat >> "${HTML_FILE}.tmp" << EOF

<style>
.build-watermark {
  position: fixed;
  bottom: 5px;
  right: 5px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.3);
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 5px;
  border-radius: 3px;
  z-index: 9999;
  pointer-events: none;
  user-select: none;
  font-family: monospace;
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const watermark = document.createElement('div');
  watermark.className = 'build-watermark';
  watermark.textContent = 'Build: ${BUILD_TIMESTAMP}';
  document.body.appendChild(watermark);
  console.log('App build: ${BUILD_TIMESTAMP}');
});
</script>

</body>
</html>
EOF
    mv "${HTML_FILE}.tmp" "$HTML_FILE"

    # Remove backup file
    rm -f "${HTML_FILE}.bak"

    echo "✓ Added build timestamp watermark: ${BUILD_TIMESTAMP}"
else
    echo "⚠ Warning: index.html not found in www directory"
fi

# Create zip file
echo "Creating zip file: ${ZIP_NAME}"
cd "${TEMP_DIR}"
zip -r "../${ZIP_NAME}" ./*
cd ..

# Clean up temporary directory
echo "Cleaning up..."
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ VoltBuilder zip created successfully: ${ZIP_NAME}"
echo "📦 Size: $(du -h "${ZIP_NAME}" | cut -f1)"
echo ""
echo "Contents included:"
echo "  - config.xml (Cordova configuration)"
echo "  - www/ (built web app)"
echo "  - res/ (icons and splash screens, if present)"
echo "  - voltbuilder.json (VoltBuilder config, if present)"
echo "  - metadata.json (metadata, if present)"
echo ""
echo "📤 Ready to upload to VoltBuilder!"