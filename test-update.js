// test-update.js
// Simple test script to verify individual flight plan updates
// Run with: node test-update.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Adjust if your app runs on different port

async function testIndividualUpdate() {
  console.log('🧪 Testing Individual Flight Plan Update...\n');

  try {
    // Test 1: Individual status update
    console.log('1️⃣ Testing individual status update...');
    const updateResponse = await axios.put(`${BASE_URL}/api/flightPlans`, {
      id: 1, // Replace with actual ID from your database
      data: { status: "en cola" }
    });
    console.log('✅ Individual update response:', updateResponse.data);

    // Test 2: Individual status update back to original
    console.log('\n2️⃣ Testing individual status update back...');
    const updateBackResponse = await axios.put(`${BASE_URL}/api/flightPlans`, {
      id: 1, // Replace with actual ID from your database
      data: { status: "sin procesar" }
    });
    console.log('✅ Update back response:', updateBackResponse.data);

    console.log('\n🎉 Individual update tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      console.log('\n💡 Tip: Check that the request body format is correct');
      console.log('   Expected: { id: number, data: { status: "en cola" } }');
    } else if (error.response?.status === 404) {
      console.log('\n💡 Tip: Make sure the flight plan ID exists in your database');
    }
  }
}

// Helper function to create test data first
async function createTestData() {
  console.log('🔧 Creating test data...\n');
  
  try {
    // Create a test folder
    const folderResponse = await axios.post(`${BASE_URL}/api/folders`, {
      name: 'Test Folder for Updates',
      userId: 1 // Replace with actual user ID
    });
    const folderId = folderResponse.data.id;
    console.log(`✅ Created test folder with ID: ${folderId}`);

    // Create test flight plan
    const planResponse = await axios.post(`${BASE_URL}/api/flightPlans`, {
      customName: 'Test Plan for Updates',
      status: 'sin procesar',
      fileContent: 'test_content_for_updates',
      userId: 1, // Replace with actual user ID
      folderId: folderId
    });
    const planId = planResponse.data.id;
    console.log(`✅ Created test plan with ID: ${planId}`);

    console.log('\n📝 Test data created successfully!');
    console.log(`   - Folder ID: ${folderId}`);
    console.log(`   - Plan ID: ${planId}`);
    console.log('\n💡 You can now run the update test with this plan ID');
    
    return { folderId, planId };
  } catch (error) {
    console.error('❌ Failed to create test data:', error.response?.data || error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 UAS Planner - Update Test Suite\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--create-data')) {
    await createTestData();
  } else if (args.includes('--help')) {
    console.log('Usage:');
    console.log('  node test-update.js              # Run update tests');
    console.log('  node test-update.js --create-data # Create test data first');
    console.log('  node test-update.js --help        # Show this help');
    console.log('\nNote: Make sure your app is running on localhost:3000');
  } else {
    await testIndividualUpdate();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testIndividualUpdate, createTestData };
