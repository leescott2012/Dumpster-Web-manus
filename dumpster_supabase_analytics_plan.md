# Dumpster — Supabase-backed Activity Log & Admin Dashboard Architecture

Leveraging an existing **Supabase** instance for Dumpster's activity log provides a robust, scalable, and centralized solution for tracking user behavior. This approach allows for real-time analytics, cross-device insights, and a powerful admin dashboard that can be accessed from anywhere. This document outlines the complete architecture, data schema, Row Level Security (RLS) policies, iOS integration, and implementation plan for Dumpster's Supabase-backed activity log and admin dashboard.

---

## 1. Architectural Strategy: Hybrid Approach with Supabase

Given the presence of a Supabase instance, we will adopt a hybrid analytics strategy. This combines the benefits of a centralized backend for comprehensive data collection with a privacy-focused external telemetry service (like TelemetryDeck) for aggregated product analytics. The core activity log will reside in Supabase, enabling a rich, real-time admin dashboard.

| Component | Primary Purpose | Data Storage | Access/Dashboard |
| :--- | :--- | :--- | :--- |
| **Supabase Activity Log** | Centralized, real-time user activity tracking, AI usage, billing. | Supabase PostgreSQL database | Native iOS Admin Panel (in-app) & Supabase Dashboard |
| **TelemetryDeck (Optional)** | Aggregated product analytics, funnels, retention (privacy-focused). | TelemetryDeck servers (anonymized) | TelemetryDeck Web Dashboard |
| **Local SwiftData Log** | On-device diagnostics, debugging, and personal stats (fallback/offline). | Local SwiftData (on-device) | Native iOS Admin Panel (in-app) |

---

## 2. Supabase Schema for Activity Log

We will create a new table in Supabase named `activity_log` to store all user events. This table will be designed to be flexible, allowing for various event types and associated metadata.

### `activity_log` Table Definition

```sql
CREATE TABLE public.activity_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_name text NOT NULL,
    category text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.activity_log IS 'Stores user activity events for analytics and debugging.';
COMMENT ON COLUMN public.activity_log.user_id IS 'The ID of the user who performed the action.';
COMMENT ON COLUMN public.activity_log.event_name IS 'A descriptive name for the event (e.g., 
photos_imported, caption_generated).';
COMMENT ON COLUMN public.activity_log.category IS 'Categorization of the event (e.g., onboarding, curation, ai, billing).';
COMMENT ON COLUMN public.activity_log.details IS 'JSONB object containing event-specific metadata.';
COMMENT ON COLUMN public.activity_log.created_at IS 'Timestamp when the event occurred.';

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own activity logs." ON public.activity_log
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs." ON public.activity_log
FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Users can view their own activity logs." ON public.activity_log
FOR SELECT USING (auth.uid() = user_id);

-- Ensure `is_admin` column exists in `public.profiles` table
-- If not, you'll need to add it:
-- ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

---

## 3. Event Taxonomy (What We Track)

To optimize the carousel curation flow and caption generation performance, we must track user interactions across three core categories: **Onboarding/Engagement**, **Carousel Curation (Aesthetic Flow)**, and **AI/Billing Performance**. The `details` JSONB column will store event-specific metadata.

### Core Event Types & Categories

| Event Name (eventName) | Category (category) | Description |
| :--- | :--- | :--- |
| `app_opened` | `system` | App launched by user. |
| `onboarding_completed` | `onboarding` | User finished the onboarding flow. |
| `photos_imported` | `curation` | User imported photos into the app. |
| `dump_created` | `curation` | User created a new photo dump. |
| `photo_reordered` | `curation` | User reordered photos within a dump. |
| `photo_removed` | `curation` | User removed a photo from a dump. |
| `dump_exported` | `curation` | User exported a photo dump (e.g., to Instagram). |
| `caption_generated` | `ai` | AI generated captions for a dump. |
| `caption_approved` | `ai` | User approved a generated caption. |
| `caption_banned` | `ai` | User banned a generated caption. |
| `paywall_viewed` | `billing` | User viewed the paywall screen. |
| `credit_transaction` | `billing` | Credits consumed or purchased. |

### Event Parameters (within `details` JSONB)

| Event Name | Parameter Key | Parameter Type | Description / Example |
| :--- | :--- | :--- | :--- |
| `photos_imported` | `count` | Integer | Number of photos imported (e.g., `12`) |
| | `source` | String | `photos_picker` or `camera` |
| `dump_created` | `photo_count` | Integer | Total photos in the dump (e.g., `8`) |
| | `vibe_badge` | String | `mismatch` or `cohesive` |
| `caption_generated`| `style` | String | `storytelling`, `emoji`, `clean`, `numbered` |
| | `provider` | String | `openai`, `claude`, `gemini`, `perplexity` |
| `credit_transaction`| `amount` | Integer | Credits consumed (e.g., `-5` or `+100`) |
| | `action` | String | `caption_generation` or `iap_purchase` |

---

## 4. The Analytics Service Layer (iOS Integration)

To ensure clean architecture and secure communication with Supabase, we will implement a centralized `AnalyticsService` in Swift. This service will handle event formatting, local caching (for offline support), and secure transmission to Supabase. It will also integrate with TelemetryDeck for aggregated, privacy-focused analytics.

```swift
import Foundation
import SwiftData
import TelemetryDeck
import Supabase

@MainActor
final class AnalyticsService: ObservableObject {
    static let shared = AnalyticsService()
    
    private var modelContext: ModelContext? // For local SwiftData caching
    private var supabaseClient: SupabaseClient? // Supabase client instance
    
    private init() {}
    
    /// Initialize with the app's SwiftData ModelContext and SupabaseClient
    func configure(
        with modelContext: ModelContext,
        supabaseClient: SupabaseClient,
        telemetryDeckAppID: String? = nil
    ) {
        self.modelContext = modelContext
        self.supabaseClient = supabaseClient
        
        // Initialize TelemetryDeck if an App ID is provided
        if let appID = telemetryDeckAppID {
            let config = TelemetryDeck.Config(appID: appID)
            TelemetryDeck.initialize(config: config)
        }
    }
    
    /// Track an event locally in SwiftData and send to Supabase and TelemetryDeck
    func track(
        _ event: AnalyticsEvent,
        category: String,
        parameters: [String: Any] = [:],
        sendToTelemetryDeck: Bool = true
    ) async {
        let timestamp = Date()
        
        // 1. Persist locally via SwiftData (for offline support and local diagnostics)
        if let context = modelContext {
            let detailsJsonString = (try? JSONSerialization.data(withJSONObject: parameters, options: []))
                .flatMap { String(data: $0, encoding: .utf8) }
            
            let logEntry = DumpActivityLog(
                timestamp: timestamp,
                eventName: event.rawValue,
                details: detailsJsonString ?? "{}",
                category: category
            )
            context.insert(logEntry)
            
            // Prune old logs to keep storage minimal (e.g., keep last 1000 events)
            try? pruneOldLogs(in: context)
        }
        
        // 2. Send to Supabase
        if let client = supabaseClient, let userID = client.auth.currentUser?.id {
            do {
                let logData: [String: Any] = [
                    "user_id": userID.uuidString,
                    "event_name": event.rawValue,
                    "category": category,
                    "details": parameters,
                    "created_at": timestamp.ISO8601Format()
                ]
                
                try await client.from("activity_log").insert(logData).execute()
            } catch {
                print("Error sending event to Supabase: \(error.localizedDescription)")
                // TODO: Implement retry mechanism or local queue for failed Supabase sends
            }
        }
        
        // 3. Forward to TelemetryDeck anonymously (if configured)
        if sendToTelemetryDeck, TelemetryDeck.isInitialized {
            // TelemetryDeck parameters must be [String: String]
            let telemetryParameters = parameters.mapValues { String(describing: $0) }
            TelemetryDeck.signal(event.rawValue, parameters: telemetryParameters)
        }
    }
    
    private func pruneOldLogs(in context: ModelContext) throws {
        let descriptor = FetchDescriptor<DumpActivityLog>(sortBy: [SortDescriptor(\.timestamp, order: .reverse)])
        let allLogs = try context.fetch(descriptor)
        
        if allLogs.count > 1000 {
            let logsToDelete = allLogs.suffix(allLogs.count - 1000)
            for log in logsToDelete {
                context.delete(log)
            }
            try context.save()
        }
    }
}

// Local SwiftData Model (retained for offline/local diagnostics)
@Model
final class DumpActivityLog {
    @Attribute(.unique) var id: String
    var timestamp: Date
    var eventName: String
    var details: String            // JSON-encoded string of parameters
    var category: String           // "system", "ai", "curation", "billing"
    
    init(
        id: String = UUID().uuidString,
        timestamp: Date = Date(),
        eventName: String,
        details: String = "{}",
        category: String = "system"
    ) {
        self.id = id
        self.timestamp = timestamp
        self.eventName = eventName
        self.details = details
        self.category = category
    }
}
```

---

## 5. Native Admin Dashboard (In-App & Supabase-powered)

The in-app Admin Dashboard will now leverage Supabase to display real-time, aggregated analytics and individual user activity. This provides a powerful tool for monitoring app health, user engagement, and AI performance.

### Admin Dashboard SwiftUI View

```swift
import SwiftUI
import SwiftData
import Supabase

struct AdminDashboardView: View {
    @Environment(\.modelContext) private var modelContext // For local logs
    @EnvironmentObject var appState: AppState
    
    @State private var supabaseLogs: [SupabaseActivityLog] = []
    @State private var isLoadingSupabaseLogs = false
    @State private var selectedCategoryFilter: String = "all"
    
    // Local SwiftData logs (for comparison/offline view)
    @Query(sort: \DumpActivityLog.timestamp, order: .reverse) 
    private var localLogs: [DumpActivityLog]
    
    var body: some View {
        NavigationStack {
            List {
                // Section 1: Core App Telemetry Stats (from Supabase)
                Section(header: Text("Supabase Analytics Summary").font(.caption).bold()) {
                    // TODO: Implement Supabase queries for aggregated stats (e.g., DAU, total dumps, AI usage)
                    Text("Total Dumps: (Loading...)")
                    Text("Total AI Generations: (Loading...)")
                    Text("Total Users: (Loading...)")
                }
                
                // Section 2: Log Category Filter
                Section {
                    Picker("Category", selection: $selectedCategoryFilter) {
                        Text("All").tag("all")
                        Text("System").tag("system")
                        Text("AI & Captions").tag("ai")
                        Text("Curation").tag("curation")
                        Text("Billing").tag("billing")
                    }
                    .pickerStyle(.segmented)
                }
                
                // Section 3: Live Event Log (from Supabase)
                Section(header: Text("Live Activity Log (Supabase)").font(.caption).bold()) {
                    if isLoadingSupabaseLogs {
                        ProgressView()
                    } else if filteredSupabaseLogs.isEmpty {
                        Text("No Supabase logs found for this category.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .italic()
                    } else {
                        ForEach(filteredSupabaseLogs.prefix(100)) { log in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(log.eventName.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .font(.subheadline)
                                        .bold()
                                    Spacer()
                                    Text(log.createdAt, style: .time)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                                if !log.details.isEmpty {
                                    Text(log.details.description) // Convert JSONB to string for display
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Text("User ID: \(log.userId.prefix(8))...")
                                    .font(.caption2)
                                    .foregroundColor(.tertiary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
                
                // Section 4: Local SwiftData Logs (for comparison/debug)
                Section(header: Text("Local Activity Log (SwiftData)").font(.caption).bold()) {
                    // Display local logs similar to previous plan, for debugging/comparison
                    // ... (omitted for brevity, similar to previous AdminDashboardView)
                    Text("See local logs for offline events.")
                }
            }
            .navigationTitle("Dumpster Admin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Refresh Supabase Logs") {
                        Task { await fetchSupabaseLogs() }
                    }
                    .font(.caption)
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear Local Logs", role: .destructive) {
                        try? modelContext.delete(model: DumpActivityLog.self)
                    }
                    .font(.caption)
                }
            }
            .task { await fetchSupabaseLogs() }
        }
    }
    
    private var filteredSupabaseLogs: [SupabaseActivityLog] {
        if selectedCategoryFilter == "all" {
            return supabaseLogs
        } else {
            return supabaseLogs.filter { $0.category == selectedCategoryFilter }
        }
    }
    
    private func fetchSupabaseLogs() async {
        isLoadingSupabaseLogs = true
        do {
            let client = SupabaseClient(supabaseURL: URL(string: "YOUR_SUPABASE_URL")!, supabaseKey: "YOUR_SUPABASE_ANON_KEY")
            let response: [SupabaseActivityLog] = try await client.from("activity_log")
                .select("id, user_id, event_name, category, details, created_at")
                .order("created_at", ascending: false)
                .limit(100)
                .execute()
                .value()
            supabaseLogs = response
        } catch {
            print("Error fetching Supabase logs: \(error.localizedDescription)")
        }
        isLoadingSupabaseLogs = false
    }
}

// Supabase-specific model for decoding fetched logs
struct SupabaseActivityLog: Decodable, Identifiable {
    let id: UUID
    let user_id: UUID
    let event_name: String
    let category: String
    let details: [String: AnyCodable] // Use AnyCodable for flexible JSONB decoding
    let created_at: Date
    
    enum CodingKeys: String, CodingKey {
        case id, user_id, event_name, category, details, created_at
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(UUID.self, forKey: .id)
        self.user_id = try container.decode(UUID.self, forKey: .user_id)
        self.event_name = try container.decode(String.self, forKey: .event_name)
        self.category = try container.decode(String.self, forKey: .category)
        self.created_at = try container.decode(Date.self, forKey: .created_at)
        
        // Custom decoding for details (JSONB)
        let detailsData = try container.decode(CodableValue.self, forKey: .details).value
        if let dict = detailsData as? [String: Any] {
            self.details = dict.mapValues { AnyCodable($0) }
        } else {
            self.details = [:]
        }
    }
}

// Helper for decoding flexible JSONB (requires a library like 'AnyCodable' or custom implementation)
// For simplicity, a basic AnyCodable struct is assumed here. In a real project, you'd use a proper library.
struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable cannot decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let array = value as? [Any] {
            try container.encode(array.map { AnyCodable($0) })
        } else if let dictionary = value as? [String: Any] {
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        } else {
            let context = EncodingError.Context(codingPath: container.codingPath, debugDescription: "AnyCodable cannot encode value")
            throw EncodingError.invalidValue(value, context)
        }
    }
    
    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        
        return false // Fallback for comparison of complex types
    }
    
    func hash(into hasher: inout Hasher) {
        if let string = value as? String {
            hasher.combine(string)
        } else if let int = value as? Int {
            hasher.combine(int)
        } else if let double = value as? Double {
            hasher.combine(double)
        } else if let bool = value as? Bool {
            hasher.combine(bool)
        }
        // For arrays and dictionaries, you might need more complex hashing or decide not to hash them
    }
}

// Helper for decoding flexible JSONB (requires a library like 'AnyCodable' or custom implementation)
// For simplicity, a basic AnyCodable struct is assumed here. In a real project, you'd use a proper library.
struct CodableValue: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([CodableValue].self) {
            value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: CodableValue].self) {
            value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "CodableValue cannot decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let array = value as? [Any] {
            try container.encode(array.map { CodableValue($0) })
        } else if let dictionary = value as? [String: Any] {
            try container.encode(dictionary.mapValues { CodableValue($0) })
        } else {
            let context = EncodingError.Context(codingPath: container.codingPath, debugDescription: "CodableValue cannot encode value")
            throw EncodingError.invalidValue(value, context)
        }
    }
}

---

## 6. Implementation & Delivery Phases

To roll out this comprehensive analytics system, we break down the implementation into manageable phases, ensuring a smooth integration with the existing SwiftUI conversion work.

### Phase 1: Supabase Backend Setup & RLS
- Create the `activity_log` table in your Supabase project with the specified schema.
- Implement the Row Level Security (RLS) policies for `activity_log` to ensure users can only insert their own data and admins can view all data.
- Add an `is_admin` column to the `public.profiles` table (if it doesn't exist) and set it for relevant admin users.

### Phase 2: iOS Analytics Service Integration
- Integrate the Supabase Swift SDK into the iOS project via Swift Package Manager.
- Implement the `AnalyticsService` class, ensuring it can send events to both the local SwiftData store and the remote Supabase `activity_log` table.
- Handle Supabase authentication within the `AnalyticsService` to associate events with the correct `user_id`.
- Implement a retry mechanism or local queue for failed Supabase sends to ensure data integrity during offline periods or network issues.
- Instrument core events (e.g., `app_opened`, `photos_imported`, `dump_created`, `caption_generated`, `credit_transaction`) throughout the app, using the `AnalyticsService`.

### Phase 3: Native Admin Dashboard Development
- Develop the `AdminDashboardView` SwiftUI view to fetch and display data from Supabase.
- Implement aggregated metrics (e.g., Daily Active Users, total dumps created, AI generation counts, credit consumption) by querying the `activity_log` table in Supabase.
- Add a user search/filter functionality to view specific user activity logs.
- Integrate the `AdminDashboardView` into a hidden or passcode-protected section of the app (e.g., within `FileCabinetMenuView`) accessible only to admin users.
- Ensure the Admin Dashboard can also display local SwiftData logs for comparison and offline debugging.

### Phase 4: TelemetryDeck (Optional) & Advanced Analytics
- (Optional) Integrate the **TelemetryDeck Swift SDK** for privacy-focused, aggregated product analytics.
- Configure `AnalyticsService` to also send anonymous signals to TelemetryDeck for high-level product insights (e.g., funnels, retention cohorts).
- Build custom dashboards and reports in the Supabase Dashboard or a third-party BI tool (e.g., Metabase, PostHog) for deeper analysis of the `activity_log` data.

---

## References

[1] The Swift Kit, *iOS App Analytics Guide — TelemetryDeck vs PostHog*, 2026.  
[2] PostHog, *How to set up analytics in iOS*, 2024.  
[3] TelemetryDeck, *Privacy-First, Real-Time Analytics for iPhone and Mac Apps*, 2026.  
[4] Supabase, *Row Level Security*, [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security), 2026.
[5] Supabase, *Swift SDK*, [https://supabase.com/docs/reference/swift/getting-started](https://supabase.com/docs/reference/swift/getting-started), 2026.

        } catch {
            print("Error fetching Supabase logs: \(error.localizedDescription)")
        }
        isLoadingSupabaseLogs = false
    }
    
    // TODO: Implement functions to fetch aggregated stats from Supabase
    private func fetchAggregatedStats() async {
        // Example: Fetch total user count
        // let userCount = try await client.from("auth.users").select("count").single().execute().value
        // Example: Fetch total dumps created
        // let dumpCount = try await client.from("activity_log").select("count").eq("event_name", "dump_created").single().execute().value
        // Example: Fetch total AI generations
        // let aiGenCount = try await client.from("activity_log").select("count").eq("event_name", "caption_generated").single().execute().value
    }
}

// Supabase-specific model for decoding fetched logs
struct SupabaseActivityLog: Decodable, Identifiable {
    let id: UUID
    let user_id: UUID
    let event_name: String
    let category: String
    let details: [String: AnyCodable] // Use AnyCodable for flexible JSONB decoding
    let created_at: Date
    
    enum CodingKeys: String, CodingKey {
        case id, user_id, event_name, category, details, created_at
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(UUID.self, forKey: .id)
        self.user_id = try container.decode(UUID.self, forKey: .user_id)
        self.event_name = try container.decode(String.self, forKey: .event_name)
        self.category = try container.decode(String.self, forKey: .category)
        self.created_at = try container.decode(Date.self, forKey: .created_at)
        
        // Custom decoding for details (JSONB)
        let detailsData = try container.decode(CodableValue.self, forKey: .details).value
        if let dict = detailsData as? [String: Any] {
            self.details = dict.mapValues { AnyCodable($0) }
        } else {
            self.details = [:]
        }
    }
}

// Helper for decoding flexible JSONB (requires a library like \'AnyCodable\' or custom implementation)
// For simplicity, a basic AnyCodable struct is assumed here. In a real project, you\'d use a proper library.
struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable cannot decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let array = value as? [Any] {
            try container.encode(array.map { AnyCodable($0) })
        } else if let dictionary = value as? [String: Any] {
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        } else {
            let context = EncodingError.Context(codingPath: container.codingPath, debugDescription: "AnyCodable cannot encode value")
            throw EncodingError.invalidValue(value, context)
        }
    }
    
    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        // Fallback for comparison of complex types
        if let lhsString = lhs.value as? String, let rhsString = rhs.value as? String { return lhsString == rhsString }
        if let lhsInt = lhs.value as? Int, let rhsInt = rhs.value as? Int { return lhsInt == rhsInt }
        if let lhsDouble = lhs.value as? Double, let rhsDouble = rhs.value as? Double { return lhsDouble == rhsDouble }
        if let lhsBool = lhs.value as? Bool, let rhsBool = rhs.value as? Bool { return lhsBool == rhsBool }
        return false
    }
    
    func hash(into hasher: inout Hasher) {
        if let string = value as? String {
            hasher.combine(string)
        } else if let int = value as? Int {
            hasher.combine(int)
        } else if let double = value as? Double {
            hasher.combine(double)
        } else if let bool = value as? Bool {
            hasher.combine(bool)
        }
        // For arrays and dictionaries, you might need more complex hashing or decide not to hash them
    }
}

// Helper for decoding flexible JSONB (requires a library like \'AnyCodable\' or custom implementation)
// For simplicity, a basic AnyCodable struct is assumed here. In a real project, you\'d use a proper library.
struct CodableValue: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([CodableValue].self) {
            value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: CodableValue].self) {
            value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "CodableValue cannot decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let array = value as? [Any] {
            try container.encode(array.map { CodableValue($0) })
        } else if let dictionary = value as? [String: Any] {
            try container.encode(dictionary.mapValues { CodableValue($0) })
        } else {
            let context = EncodingError.Context(codingPath: container.codingPath, debugDescription: "CodableValue cannot encode value")
            throw EncodingError.invalidValue(value, context)
        }
    }
}

---

## 6. Implementation & Delivery Phases

To roll out this comprehensive analytics system, we break down the implementation into manageable phases, ensuring a smooth integration with the existing SwiftUI conversion work.

### Phase 1: Supabase Backend Setup & RLS
- Create the `activity_log` table in your Supabase project with the specified schema.
- Implement the Row Level Security (RLS) policies for `activity_log` to ensure users can only insert their own data and admins can view all data.
- Add an `is_admin` column to the `public.profiles` table (if it doesn\'t exist) and set it for relevant admin users.

### Phase 2: iOS Analytics Service Integration
- Integrate the Supabase Swift SDK into the iOS project via Swift Package Manager.
- Implement the `AnalyticsService` class, ensuring it can send events to both the local SwiftData store and the remote Supabase `activity_log` table.
- Handle Supabase authentication within the `AnalyticsService` to associate events with the correct `user_id`.
- Implement a retry mechanism or local queue for failed Supabase sends to ensure data integrity during offline periods or network issues.
- Instrument core events (e.g., `app_opened`, `photos_imported`, `dump_created`, `caption_generated`, `credit_transaction`) throughout the app, using the `AnalyticsService`.

### Phase 3: Native Admin Dashboard Development
- Develop the `AdminDashboardView` SwiftUI view to fetch and display data from Supabase.
- Implement aggregated metrics (e.g., Daily Active Users, total dumps created, AI generation counts, credit consumption) by querying the `activity_log` table in Supabase.
- Add a user search/filter functionality to view specific user activity logs.
- Integrate the `AdminDashboardView` into a hidden or passcode-protected section of the app (e.g., within `FileCabinetMenuView`) accessible only to admin users.
- Ensure the Admin Dashboard can also display local SwiftData logs for comparison and offline debugging.

### Phase 4: TelemetryDeck (Optional) & Advanced Analytics
- (Optional) Integrate the **TelemetryDeck Swift SDK** for privacy-focused, aggregated product analytics.
- Configure `AnalyticsService` to also send anonymous signals to TelemetryDeck for high-level product insights (e.g., funnels, retention cohorts).
- Build custom dashboards and reports in the Supabase Dashboard or a third-party BI tool (e.g., Metabase, PostHog) for deeper analysis of the `activity_log` data.

---

## References

[1] The Swift Kit, *iOS App Analytics Guide — TelemetryDeck vs PostHog*, 2026.  
[2] PostHog, *How to set up analytics in iOS*, 2024.  
[3] TelemetryDeck, *Privacy-First, Real-Time Analytics for iPhone and Mac Apps*, 2026.  
[4] Supabase, *Row Level Security*, [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security), 2026.
[5] Supabase, *Swift SDK*, [https://supabase.com/docs/reference/swift/getting-started](https://supabase.com/docs/reference/swift/getting-started), 2026.
