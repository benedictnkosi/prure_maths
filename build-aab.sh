#!/bin/bash

# Exit on error
set -e

# Copy google-services.json to the correct location
echo "Copying google-services.json to app directory..."
cp google-services.json android/app/google-services.json

# Copy and rename keystore file
echo "Copying and renaming keystore file..."
cp @nkosib__exam-quiz.jks android/app/keystore.jks

# Copy build.gradle files to android directory
echo "Copying build.gradle files to android directory..."
cp android-build.gradle android/build.gradle

# Update versions in app-build.gradle before copying
echo "Updating versions in app-build.gradle..."

# Create a temporary copy of app-build.gradle
cp app-build.gradle app-build.gradle.tmp

# Extract current versionCode and versionName from the temporary file
CURRENT_CODE=$(grep 'versionCode' app-build.gradle.tmp | grep -o '[0-9]\+')
CURRENT_NAME=$(grep 'versionName' app-build.gradle.tmp | grep -o '"[^"]*"' | sed 's/"//g')

# Check if we successfully extracted the versions
if [ -z "$CURRENT_CODE" ]; then
    echo "Error: Could not extract versionCode from app-build.gradle"
    exit 1
fi

if [ -z "$CURRENT_NAME" ]; then
    echo "Error: Could not extract versionName from app-build.gradle"
    exit 1
fi

# Increment versionCode
NEW_CODE=$((CURRENT_CODE + 1))

# Handle versionName increment - if it's a single number, convert to semantic versioning
if [[ $CURRENT_NAME =~ ^[0-9]+$ ]]; then
    # Single number version, convert to semantic versioning
    NEW_NAME="1.0.$CURRENT_NAME"
else
    # Already semantic versioning, increment last number
    NEW_NAME=$(echo $CURRENT_NAME | awk -F. '{$NF = $NF + 1;}1' OFS=.)
fi

# Update the temporary file
sed -i '' "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" app-build.gradle.tmp
sed -i '' "s/versionName \"$CURRENT_NAME\"/versionName \"$NEW_NAME\"/" app-build.gradle.tmp

echo "Updated version from $CURRENT_CODE ($CURRENT_NAME) to $NEW_CODE ($NEW_NAME)"

# Copy the updated app-build.gradle to android directory
cp app-build.gradle.tmp android/app/build.gradle

# Clean up temporary file
rm app-build.gradle.tmp

# Navigate to android directory and run build commands
cd android
./gradlew clean
./gradlew bundleRelease

# Copy the AAB file
cp app/build/outputs/bundle/release/app-release.aab /Users/benedictnkosi/Documents/Dimpo Learning Assets/app-release.aab

echo "Build completed!"