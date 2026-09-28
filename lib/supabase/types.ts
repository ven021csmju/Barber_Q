/**
 * Schema types, verified against the live Supabase project.
 *
 * Every column below was confirmed by querying the database directly:
 * existence via `order by <col>` (HTTP 200 = column, PostgREST `42703` =
 * undefined_column) and type via an invalid literal, which makes Postgres
 * report the type in the error. Names that returned `42703` are absent and
 * are deliberately not declared.
 *
 * Verified facts that shape this file:
 *  - There are NO foreign keys between the app's own tables, so PostgREST embeds
 *    fail with `PGRST200` and relations are joined in memory. (The migration
 *    does add a real bookings -> time_slots FK; it is declared as a plain
 *    column, and the join is still done in memory for a single predictable
 *    shape rather than relying on embed behaviour.)
 *  - `barbers.status` and `promotions.discount_type` are plain `text`, so they
 *    are typed as `string` and mapped tolerantly. `bookings.status` and
 *    `time_slots.status` ARE constrained by CHECK after the migration and are
 *    typed as unions.
 *  - `barbers.rank` is deliberately absent. PostgREST binds the bare name to
 *    the `rank()` aggregate in both SELECT and ORDER BY, so it could not be
 *    confirmed as a column and is not declared.
 *
 * Guest booking (migration 20260926000000_guest_booking.sql):
 *  - `time_slots` is date-specific (`slot_date`) rather than a recurring
 *    weekly schedule, and a booking's date comes from its slot.
 *  - `bookings` holds a guest `customer_name` and a `time_slot_id`. There is no
 *    customer account, so `customer_id` / `auth_user_id` are gone.
 *  - `customers`, `barbers`, `services` and `promotions` are no longer used by
 *    the booking flow. The tables still exist (they were not dropped), so their
 *    types remain here for the admin screens that still reference them.
 */

export type ISODateTime = string; // "2026-09-28T09:00:00+07:00"
export type ISODate = string; // "2026-09-28"
export type ClockTime = string; // "09:00:00" from Postgres `time`

/**
 * Statuses are free-form text in the database, so this is deliberately not a
 * union. `BOOKING_STATUS_META` in lib/utils maps the values the app writes and
 * degrades gracefully for anything else.
 */
export type LooseStatus = string;

/* ------------------------------------------------------------------ *
 * customers  (id is uuid)
 * ------------------------------------------------------------------ */

export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  created_at: ISODateTime;
};

export type CustomerUpdate = Partial<Omit<Customer, "id" | "created_at">>;

/* ------------------------------------------------------------------ *
 * barbers  (id is bigint -> number)
 * ------------------------------------------------------------------ */

export type Barber = {
  id: number;
  name: string;
  phone: string | null;
  status: LooseStatus;
  created_at: ISODateTime;
  /** Added by ALTER TABLE; absent from the row until then. */
  avatar_url?: string | null;
};

export type BarberInsert = {
  name: string;
  phone?: string | null;
  status?: LooseStatus;
};

export type BarberUpdate = Partial<BarberInsert>;

/* ------------------------------------------------------------------ *
 * services
 * ------------------------------------------------------------------ */

export type Service = {
  id: number;
  name: string;
  description: string | null;
  /** Postgres `numeric` arrives as a JSON number via PostgREST. */
  price: number;
  duration_minutes: number;
  created_at: ISODateTime;
  /** Added by ALTER TABLE; absent from the row until then. */
  image_url?: string | null;
};

export type ServiceInsert = {
  name: string;
  price: number;
  duration_minutes: number;
  description?: string | null;
};

export type ServiceUpdate = Partial<ServiceInsert>;

/* ------------------------------------------------------------------ *
 * time_slots  (date-specific; the date lives on the slot, not the booking)
 * ------------------------------------------------------------------ */

export type TimeSlotStatus = "available" | "blocked";

export type TimeSlot = {
  id: number;
  /** Postgres `date` as "YYYY-MM-DD". */
  slot_date: ISODate;
  start_time: ClockTime;
  end_time: ClockTime;
  status: TimeSlotStatus;
  created_at: ISODateTime;
};

export type TimeSlotInsert = {
  slot_date: ISODate;
  start_time: ClockTime;
  end_time: ClockTime;
  /** Defaults to 'available' in the database. */
  status?: TimeSlotStatus;
};

export type TimeSlotUpdate = Partial<TimeSlotInsert>;

/* ------------------------------------------------------------------ *
 * bookings  (guest bookings: a name, a slot, a status — no account)
 * ------------------------------------------------------------------ */

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

/**
 * The only statuses that hold a slot.
 *
 * `pending` and `confirmed` are an active booking. `cancelled` and `completed`
 * are history: neither keeps the slot out of sale, so a completed appointment
 * frees its times for the next guest and a cancelled one is immediately
 * bookable again.
 *
 * This is the single source of truth for the admin side. The customer side
 * derives the same fact from the `booked_slot_ids()` RPC, which the database
 * owns -- if the two ever disagree, the database is right and this needs
 * updating to match.
 */
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;

export function isActiveBooking(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed";
}

/**
 * Legal status moves. `completed` and `cancelled` are terminal: a finished or
 * abandoned appointment is never reopened, so a slot cannot be handed back to a
 * guest who already had it.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export type Booking = {
  id: number;
  customer_name: string;
  /** Nullable for bookings created before phone collection was added. */
  customer_phone: string | null;
  /** FK -> time_slots.id */
  time_slot_id: number;
  status: BookingStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

export type BookingInsert = {
  customer_name: string;
  customer_phone?: string | null;
  time_slot_id: number;
  status?: BookingStatus;
};

export type BookingUpdate = Partial<BookingInsert>;

/**
 * A slot joined with the fact of whether it is already taken.
 *
 * The guest UI needs both halves of that in one paint, and `booked_slot_ids()`
 * deliberately exposes nothing but ids, so the two are combined in memory.
 */
export type SlotWithAvailability = TimeSlot & {
  isBooked: boolean;
};

/* ------------------------------------------------------------------ *
 * promotions
 * ------------------------------------------------------------------ */

export type Promotion = {
  id: number;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  start_at: ISODateTime | null;
  end_at: ISODateTime | null;
  created_at: ISODateTime;
};

/* ------------------------------------------------------------------ *
 * the shape the UI consumes
 * ------------------------------------------------------------------ */

/**
 * A booking with its slot attached. There are no foreign-key joins to embed, so
 * the slot is looked up in memory; `date` and `time` are derived from it.
 */
export type BookingWithRefs = Booking & {
  timeSlot: Pick<TimeSlot, "id" | "slot_date" | "start_time" | "end_time"> | null;
  /** Derived from the slot, since bookings stores no date. */
  date: ISODate | null;
  /** Derived from the slot, since bookings stores no time. */
  time: string | null;
};

/* ------------------------------------------------------------------ *
 * the client generic
 * ------------------------------------------------------------------ */

/**
 * No `Relationships` entries: confirmed by PGRST200 on every embed attempt.
 */
type Table = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      customers: Table & { Row: Customer; Update: CustomerUpdate; Insert: Partial<Customer> };
      barbers: Table & { Row: Barber; Insert: BarberInsert; Update: BarberUpdate };
      services: Table & { Row: Service; Insert: ServiceInsert; Update: ServiceUpdate };
      time_slots: Table & {
        Row: TimeSlot;
        Insert: Partial<TimeSlot>;
        Update: TimeSlotUpdate;
      };
      bookings: Table & { Row: Booking; Insert: BookingInsert; Update: BookingUpdate };
      promotions: Table & { Row: Promotion; Insert: Partial<Promotion>; Update: Partial<Promotion> };
    };
    Views: Record<string, never>;
    /**
     * Guest-facing RPC. It returns slot ids only -- never customer names -- so
     * the time grid can grey out taken slots without guests reading `bookings`.
     */
    Functions: {
      /**
       * The single atomic booking operation.
       *
       * `time_slots.status` is never written by this: it stays 'available' and
       * occupancy is expressed by the booking row. Returns a controlled result
       * rather than raising, so a lost race is an ordinary outcome.
       */
      create_booking: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_time_slot_id: number;
        };
        Returns: Booking;
      };
      booked_slot_ids: {
        Args: { p_date: ISODate };
        Returns: { time_slot_id: number }[];
      };
    };
    /** No enums: every status-like column is plain `text`. */
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
