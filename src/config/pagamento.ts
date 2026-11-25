export const pagamentoTransferencia = {
  metodo: "transferencia" as const,
  titular: "José Brito",
  iban: "BE12 9059 6568 2392",
  swift: "TRWIBEB1XXX",
  bancoNota: "Wise (EUR e outras moedas)",
  moradaBanco: "Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium",
  instrucoes:
    "Faça a transferência com a referência do seu e-mail de registo. O acesso é libertado após confirmação manual (normalmente em poucas horas úteis).",
};

export const pagamentoPaypal = {
  metodo: "paypal" as const,
  url: "",
  email: "",
  instrucoes:
    "Pague via PayPal e indique o mesmo e-mail do registo na nota. O acesso é libertado após confirmação.",
};

export type MetodoPagamento = "transferencia" | "paypal";
