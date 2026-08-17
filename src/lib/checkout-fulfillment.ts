import type Stripe from "stripe";

export const PICKUP_WILTON_ID = "pickup_wilton";

export type CheckoutFulfillmentOption = {
  id: string;
  label: string;
  addressLines: string[];
  hint: string;
  stripeOptionLabel: string;
};

export const CHECKOUT_FULFILLMENT_OPTIONS: CheckoutFulfillmentOption[] = [
  {
    id: PICKUP_WILTON_ID,
    label: "Pickup in Wilton",
    addressLines: ["Jeff Brian Rd", "Wilton, CA"],
    hint: "We’ll confirm a pickup window after you pay.",
    stripeOptionLabel: "Pickup in Wilton — Jeff Brian Rd",
  },
];

export function fulfillmentOption(id?: string | null): CheckoutFulfillmentOption {
  const match = CHECKOUT_FULFILLMENT_OPTIONS.find((option) => option.id === id);
  return match || CHECKOUT_FULFILLMENT_OPTIONS[0];
}

export function fulfillmentSummary(id?: string | null): string {
  const option = fulfillmentOption(id);
  return `${option.label} · ${option.addressLines.join(", ")}`;
}

/** Attach pickup (and later ship) to an embedded Checkout session. */
export function applyCheckoutFulfillment(
  sessionParams: Stripe.Checkout.SessionCreateParams,
  fulfillmentId?: string | null,
  opts?: { includeShippingRate?: boolean },
) {
  const option = fulfillmentOption(fulfillmentId);
  sessionParams.metadata = {
    ...(sessionParams.metadata || {}),
    fulfillment: option.id,
    pickupLabel: option.label,
    pickupAddress: option.addressLines.join(", "),
  };
  sessionParams.custom_fields = [
    ...(sessionParams.custom_fields || []),
    {
      key: "fulfillment",
      label: { type: "custom", custom: "Pickup" },
      type: "dropdown",
      dropdown: {
        options: CHECKOUT_FULFILLMENT_OPTIONS.map((row) => ({
          label: row.stripeOptionLabel,
          value: row.id,
        })),
      },
    },
  ];
  sessionParams.custom_text = {
    ...(sessionParams.custom_text || {}),
    submit: {
      message: `${option.label} at ${option.addressLines.join(", ")}.`,
    },
  };

  if (opts?.includeShippingRate && sessionParams.mode === "payment") {
    sessionParams.shipping_options = [
      {
        shipping_rate_data: {
          display_name: option.label,
          type: "fixed_amount",
          fixed_amount: { amount: 0, currency: "usd" },
          delivery_estimate: {
            minimum: { unit: "business_day", value: 0 },
            maximum: { unit: "business_day", value: 2 },
          },
        },
      },
    ];
  }
}
