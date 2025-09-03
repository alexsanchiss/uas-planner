// test-deletion.js
// Simple test script to verify CSV deletion functionality
// Run with: node test-deletion.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Adjust if your app runs on different port

async function testDeletion() {
  console.log('🧪 Testing Flight Plan Deletion with CSV Cleanup...\n');

  try {
    // Test 1: Individual deletion
    console.log('1️⃣ Testing individual deletion...');
    const individualResponse = await axios.delete(`${BASE_URL}/api/flightPlans`, {
      data: { id: 1 } // Replace with actual ID from your database
    });
    console.log('✅ Individual deletion response:', individualResponse.data);

    // Test 2: Bulk deletion
    console.log('\n2️⃣ Testing bulk deletion...');
    const bulkResponse = await axios.delete(`${BASE_URL}/api/flightPlans`, {
      data: { ids: [2, 3, 4] } // Replace with actual IDs from your database
    });
    console.log('✅ Bulk deletion response:', bulkResponse.data);

    // Test 3: Verify CSV cleanup
    console.log('\n3️⃣ Verifying CSV cleanup...');
    if (bulkResponse.data.deletedCsvs > 0) {
      console.log(`✅ Successfully cleaned up ${bulkResponse.data.deletedCsvs} CSV results`);
    } else {
      console.log('ℹ️ No CSV results were associated with the deleted plans');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Deleted plans: ${bulkResponse.data.deletedPlans}`);
    console.log(`   - Deleted CSV results: ${bulkResponse.data.deletedCsvs}`);
    console.log(`   - Total operations: ${bulkResponse.data.totalDeleted}`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Tip: Make sure the flight plan IDs exist in your database');
    } else if (error.response?.status === 400) {
      console.log('\n💡 Tip: Check that the request body format is correct');
    }
  }
}

// Helper function to create test data first
async function createTestData() {
  console.log('🔧 Creating test data...\n');
  
  try {
    // Create a test folder
    const folderResponse = await axios.post(`${BASE_URL}/api/folders`, {
      name: 'Test Folder for Deletion',
      userId: 1 // Replace with actual user ID
    });
    const folderId = folderResponse.data.id;
    console.log(`✅ Created test folder with ID: ${folderId}`);

    // Create test flight plans
    const plans = [];
    for (let i = 1; i <= 3; i++) {
      const planResponse = await axios.post(`${BASE_URL}/api/flightPlans`, {
        customName: `Test Plan ${i}`,
        status: 'sin procesar',
        fileContent: `test_content_${i}`,
        userId: 1, // Replace with actual user ID
        folderId: folderId
      });
      plans.push(planResponse.data.id);
      console.log(`✅ Created test plan ${i} with ID: ${planResponse.data.id}`);
    }

    console.log('\n📝 Test data created successfully!');
    console.log(`   - Folder ID: ${folderId}`);
    console.log(`   - Plan IDs: ${plans.join(', ')}`);
    console.log('\n💡 You can now run the deletion test with these IDs');
    
    return { folderId, planIds: plans };
  } catch (error) {
    console.error('❌ Failed to create test data:', error.response?.data || error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 UAS Planner - Deletion Test Suite\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--create-data')) {
    await createTestData();
  } else if (args.includes('--help')) {
    console.log('Usage:');
    console.log('  node test-deletion.js              # Run deletion tests');
    console.log('  node test-deletion.js --create-data # Create test data first');
    console.log('  node test-deletion.js --help        # Show this help');
    console.log('\nNote: Make sure your app is running on localhost:3000');
  } else {
    await testDeletion();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testDeletion, createTestData };
