-- Update seller_banking_info table to use IBAN instead of US banking fields
ALTER TABLE public.seller_banking_info 
DROP COLUMN routing_number,
DROP COLUMN account_number,
DROP COLUMN bank_name,
ADD COLUMN iban TEXT NOT NULL DEFAULT '';

-- Remove the default after adding the column
ALTER TABLE public.seller_banking_info 
ALTER COLUMN iban DROP DEFAULT;