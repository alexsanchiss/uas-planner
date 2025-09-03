# UAS Planner - Unified API Documentation

## Overview

The UAS Planner has been optimized with a **unified API architecture** that consolidates all flight plan operations into single endpoints, supporting both individual and bulk operations. This system dramatically improves performance for large datasets while maintaining backward compatibility.

## 🚀 Key Benefits

- **Single endpoint per resource** = Better performance and maintainability
- **Bulk operations** = Reduced network overhead for large datasets
- **Transaction safety** = Data consistency across operations
- **Unified error handling** = Consistent user experience
- **Automatic optimization** = Smart chunking and batching

## 📚 API Endpoints

### 1. Flight Plans API (`/api/flightPlans`)

**Unified endpoint for all flight plan operations**

#### **POST** - Create Flight Plans
```typescript
// Individual creation
POST /api/flightPlans
Body: {
  customName: "Plan A",
  status: "sin procesar",
  fileContent: "file_content",
  userId: 123,
  folderId?: 456,
  uplan?: {...},
  scheduledAt?: "2024-01-01T10:00:00Z"
}

// Bulk creation
POST /api/flightPlans
Body: {
  items: [
    { customName: "Plan A", status: "sin procesar", fileContent: "...", userId: 123 },
    { customName: "Plan B", status: "sin procesar", fileContent: "...", userId: 123 }
  ]
}
```

#### **PUT** - Update Flight Plans
```typescript
// Individual update
PUT /api/flightPlans
Body: {
  id: 123,
  data: { status: "en cola" }
}

// Bulk uniform update (same data for all)
PUT /api/flightPlans
Body: {
  ids: [123, 456, 789],
  data: { status: "en cola" }
}

// Bulk per-item update (different data for each)
PUT /api/flightPlans
Body: {
  items: [
    { id: 123, data: { scheduledAt: "2024-01-01T10:00:00Z" } },
    { id: 456, data: { scheduledAt: "2024-01-02T10:00:00Z" } }
  ]
}
```

#### **DELETE** - Delete Flight Plans
```typescript
// Individual deletion
DELETE /api/flightPlans
Body: { id: 123 }

// Bulk deletion
DELETE /api/flightPlans
Body: { ids: [123, 456, 789] }

// Response includes CSV cleanup information:
{
  "deletedPlans": 3,
  "deletedCsvs": 2,
  "totalDeleted": 5,
  "message": "Successfully deleted 3 flight plans and 2 CSV results"
}
```

#### **GET** - List Flight Plans
```typescript
GET /api/flightPlans?userId=123
Response: FlightPlan[]
```

### 2. CSV Results API (`/api/csvResult`)

**Unified endpoint for all CSV result operations**

#### **GET** - Fetch Individual CSV
```typescript
GET /api/csvResult?id=123
Response: { csvResult: "csv_content_here" }
```

#### **POST** - Bulk Fetch CSV Results
```typescript
POST /api/csvResult
Body: { ids: [123, 456, 789] }
Response: {
  items: [
    { id: 123, customName: "Plan A", csvResult: "csv_content_a" },
    { id: 456, customName: "Plan B", csvResult: "csv_content_b" }
  ]
}
```

#### **DELETE** - Delete CSV Results
```typescript
// Individual deletion
DELETE /api/csvResult
Body: { id: 123 }

// Bulk deletion
DELETE /api/csvResult
Body: { ids: [123, 456, 789] }
```

### 3. Specialized Endpoints

#### **U-Plan Generation** (`/api/flightPlans/[id]/uplan`)
```typescript
POST /api/flightPlans/{id}/uplan
// Generates U-Plan and sends to external authorization API
// Kept separate due to complex business logic
```

## 🔧 Performance Optimizations

### **Batch Processing**
- **Flight Plans**: 500 IDs per API call
- **CSV Operations**: 5000 IDs per request
- **Large Operations**: Automatically chunked into 200-item transactions

### **Concurrency Control**
- **Uploads**: Limited to 5 simultaneous operations
- **Downloads**: Multiple zip files for large datasets (1000 files per zip)
- **Memory Management**: Automatic chunking to prevent browser crashes

### **Database Optimization**
- **Prisma Methods**: Uses `createMany`, `updateMany`, `deleteMany`
- **Transactions**: Atomic operations for data consistency
- **Parallel Queries**: CSV content and metadata fetched simultaneously

## 🗄️ Database Relationships

### **Flight Plan ↔ CSV Result**
- **flightPlan.csvResult**: Integer field pointing to csvResult.id
- **csvResult.id**: Primary key of CSV result table
- **Relationship**: One-to-one (flight plan can have one CSV result)
- **Deletion**: When flight plan is deleted, associated CSV result is automatically removed

### **Data Integrity**
- **Transaction Safety**: CSV deletion and flight plan deletion happen atomically
- **Orphan Prevention**: No CSV results left without corresponding flight plans
- **Bulk Operations**: Handles cases where some plans may not have CSV results

## 📊 Migration Guide

### **From Old Individual Endpoints**
```typescript
// OLD (Deprecated)
PUT /api/flightPlans/123
Body: { status: "en cola" }

// NEW (Unified)
PUT /api/flightPlans
Body: { id: 123, data: { status: "en cola" } }
```

### **From Old Bulk Endpoints**
```typescript
// OLD (Deprecated)
POST /api/flightPlans/bulk
Body: { items: [...] }

// NEW (Unified)
POST /api/flightPlans
Body: { items: [...] }
```

## 🛡️ Security & Validation

### **Input Sanitization**
- Automatic type conversion and validation
- Maximum limits to prevent abuse
- User ID validation for all operations

### **Error Handling**
- Graceful fallback for invalid data
- Clear error messages with HTTP status codes
- Transaction rollback on partial failures

### **Rate Limiting**
- Maximum 5000 IDs per bulk operation
- Maximum 2000 items per transaction chunk
- Body size limits (50MB for flight plans, 10MB for CSV)

## 🧪 Testing & Development

### **Smoke Testing**
```bash
# Test large batch uploads
# Test bulk status updates
# Test bulk deletions (verify CSV cleanup)
# Test CSV bulk operations
```

### **Performance Testing**
- Upload 2500+ flight plans
- Bulk status updates on 1000+ plans
- Download large CSV datasets
- Concurrent operations testing

## 📈 Monitoring & Logging

### **API Logs**
- All operations logged with timestamps
- Error details captured for debugging
- Performance metrics for bulk operations

### **Database Monitoring**
- Transaction success/failure rates
- Bulk operation completion times
- Memory usage during large operations

## 🔄 Backward Compatibility

The unified API maintains full backward compatibility:
- Individual operations work exactly as before
- Bulk operations provide enhanced performance
- Error handling remains consistent
- Response formats unchanged

## 🚀 Future Enhancements

- **Real-time Progress**: WebSocket updates for long-running operations
- **Advanced Batching**: Dynamic batch size optimization
- **Caching Layer**: Redis integration for frequently accessed data
- **Async Processing**: Background job queue for very large operations

---

## 📞 Support

For questions about the unified API system:
1. Check this documentation
2. Review the inline code comments
3. Test with small datasets first
4. Monitor performance metrics

**Remember**: The unified API automatically detects operation type and applies the optimal processing method!

**Important**: When deleting flight plans, associated CSV results are automatically cleaned up to maintain data integrity.
