export interface StudentFeesState {
  fees_full_payment_paid?: boolean | null;
  fees_installment1_paid?: boolean | null;
  fees_installment2_paid?: boolean | null;
}

export function hasFullPaymentMarked(student: StudentFeesState): boolean {
  return Boolean(student.fees_full_payment_paid);
}

export function isFullyPaid(student: StudentFeesState): boolean {
  return hasFullPaymentMarked(student) || (Boolean(student.fees_installment1_paid) && Boolean(student.fees_installment2_paid));
}

export function isPartiallyPaid(student: StudentFeesState): boolean {
  return !hasFullPaymentMarked(student) && (Boolean(student.fees_installment1_paid) || Boolean(student.fees_installment2_paid));
}

export function getFeesStatusLabel(student: StudentFeesState): string {
  if (hasFullPaymentMarked(student)) return "Full Payment";
  if (Boolean(student.fees_installment1_paid) && Boolean(student.fees_installment2_paid)) {
    return "Fully Paid";
  }
  if (Boolean(student.fees_installment1_paid) || Boolean(student.fees_installment2_paid)) {
    return "Partially Paid";
  }
  return "Not Paid";
}
