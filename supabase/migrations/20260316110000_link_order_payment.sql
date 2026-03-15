-- RPC: link_order_payment
-- Called by the SPA after Stripe.js confirms a PaymentIntent.
-- Only the buyer of the order may call this.

create or replace function public.link_order_payment(
  p_order_id  uuid,
  p_provider  text,
  p_reference text
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update public.commerce_orders
  set payment_provider  = p_provider,
      payment_reference = p_reference
  where id                = p_order_id
    and buyer_profile_id  = auth.uid();
end;
$$;
