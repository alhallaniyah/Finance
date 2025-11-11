# Kitchen Module – Stopwatch-Based Process Tracking
Date: 2025-11-08

## Purpose
Monitor and validate the duration of each halwa batch process using an in-app stopwatch system.
The system records real process times, prevents falsified data, and allows admins to validate performance against predefined standards.
The module now includes an **Admin Kitchen Dashboard** where admins can define **halwa types** and **process templates**, which dynamically shape the steps in each batch depending on what halwa is being cooked.

## Key Flow

1. **Batch Creation**
   - Chef selects one or multiple halwa types (e.g. Sultaniya, Malakiya, Asal).
   - Enters starch weight and confirms start.
   - System creates `kitchen_batch` record and generates process list based on selected halwa types.

2. **Dynamic Process Generation**
   - The process list is built from templates defined by the admin:
     - Sultaniya → 10 steps
     - Malakiya adds +2 (e.g., Add Honey, Add Walnuts)
     - Asal adds +1 (Add Honey)
   - Combined halwa selections merge templates, remove duplicates, and determine total processes.

3. **Stopwatch Recording**
   - Chef sees each process in sequence.
   - Clicking “Start” begins the timer, “Next” ends current step, saves timestamps, and auto-loads the next process.
   - Each step logs start_time, end_time, duration_minutes, and user ID.

4. **Batch Completion**
   - After the final process, “Finish Batch” records batch end time and updates status to `completed`.

5. **Admin Validation**
   - Admin reviews and clicks **Validate Batch**.
   - The system checks:
     - Each process vs. standard ± buffer.
     - Total duration vs. batch start/end time.
     - Pattern vs. previous three similar batches.
   - Validation outcome: `good`, `moderate`, or `shift_detected`.

6. **Admin Adjustments**
   - Admin may edit process templates, durations, or buffers through the dashboard.
   - Any manual edit automatically logs a remark.

## Entities

### kitchen_batches
- id (UUID, PK)
- company_id (FK → companies.id)
- halwa_type (text or array if multiple)
- starch_weight (numeric)
- chef_id (FK → company_users.user_id)
- start_time (timestamptz)
- end_time (timestamptz)
- total_duration (numeric, computed)
- status ('in_progress' | 'completed' | 'validated')
- validation_status ('good' | 'moderate' | 'shift_detected')
- validated_by (UUID)
- validation_comments (text)
- created_at (timestamptz)
- created_by (UUID)

### kitchen_process_types
- id (UUID, PK)
- company_id (FK → companies.id)
- name (text)
- standard_duration_minutes (numeric)
- variation_buffer_minutes (numeric)
- active (boolean)
- created_by (UUID)
- created_at (timestamptz)

### kitchen_processes
- id (UUID, PK)
- batch_id (FK → kitchen_batches.id)
- company_id (FK → companies.id)
- process_type_id (FK → kitchen_process_types.id)
- sequence_order (int)
- start_time (timestamptz)
- end_time (timestamptz)
- duration_minutes (numeric)
- remarks (text)
- auto_recorded (boolean)
- created_by (UUID)
- created_at (timestamptz)

### kitchen_halwa_types
- id (UUID, PK)
- company_id (FK → companies.id)
- name (text)
- base_process_count (int)
- active (boolean)
- created_by (UUID)
- created_at (timestamptz)

### kitchen_halwa_process_map
- id (UUID, PK)
- halwa_type_id (FK → kitchen_halwa_types.id)
- process_type_id (FK → kitchen_process_types.id)
- sequence_order (int)
- additional_processes (int)
- created_by (UUID)
- created_at (timestamptz)

## Validation Rules

- Compare each process duration to its standard ± buffer.
- Ensure total process duration ≈ (batch.end_time - batch.start_time).
- If process durations exactly match previous three batches → mark as suspicious.
- Manual edits require remarks.
- Validation result options:
  - **good** — within all tolerances
  - **moderate** — minor deviation
  - **shift_detected** — large deviation or falsification

## Admin Kitchen Dashboard

### Features
1. **Halwa Types Tab**
   - Add, edit, activate/deactivate halwa types.
   - Define `base_process_count`.
   - Button: *Edit Template* opens process mapping view.

2. **Process Templates Tab**
   - For each halwa type, list its mapped processes with durations and order.
   - Add/remove/reorder via drag-and-drop.
   - Save updates to `kitchen_halwa_process_map`.

3. **Batch Validation Tab**
   - Shows recent batches, validation results, average durations by halwa type, and deviation summaries.

### Behavior
- When a halwa type has extra steps, the system automatically expands the process list for new batches.
- Example:
  - Sultaniya → 10 steps
  - +Malakiya → 12
  - +Asal → 13 (merged unique)

## UI Behavior

- **Stopwatch Screen:** shows active process, elapsed time, Start/Next buttons.
- **Batch Summary:** after completion, lists all processes, durations, and total time.
- **Admin View:** edit durations, buffers, halwa templates, and validate batches.

## Safeguards

- Processes auto-lock after “Next.”
- Offline-safe using IndexedDB to queue timestamps until sync.
- Each edit creates an audit entry (`edited_by`, `edit_reason`).
- Validation flags visible only to admin/manager roles.

## Integration

- **Staff Module:** auto-generate warning if falsification is flagged.
- **Finance Module:** link wasted or rejected batches to expense entries.
- **POS Module:** optional linkage between production batch and retail sale for cost traceability.

## Future Enhancements

- Auto-generate performance reports by chef and halwa type.
- Allow exporting process duration graphs.
- Add AI anomaly detection for falsified timing patterns.
- Introduce batch tagging (e.g., “Eid Rush,” “Training Batch”).

This extended documentation fully defines the Kitchen Stopwatch Module, including dynamic halwa process templates, admin configuration dashboard, and integration logic. It captures the entire lifecycle from batch creation to validation and reporting, supporting multi-halwa operations and robust data integrity.
