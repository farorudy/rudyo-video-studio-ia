import { PAID_GENERATION_UNAVAILABLE_MESSAGE, type PaidGenerationRefusal } from "@/lib/montage/paid-generation-gate";

/**
 * Levée avant toute réservation de crédits lorsque la génération payante ne
 * peut pas être garantie. Les routes la traduisent en 503 sans débit.
 */
export class PaidGenerationUnavailableError extends Error {
  readonly refusal: PaidGenerationRefusal;

  constructor(refusal: PaidGenerationRefusal) {
    super(PAID_GENERATION_UNAVAILABLE_MESSAGE);
    this.name = "PaidGenerationUnavailableError";
    this.refusal = refusal;
  }
}
