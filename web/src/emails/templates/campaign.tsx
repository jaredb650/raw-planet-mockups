/** Marketing emails: host-written campaigns and the win-back note (EN + ES). Plain letters, one button. */
import { Fragment } from "react";
import { BUSINESS } from "@/lib/config";
import { Layout } from "../components/Layout";
import { A, Actions, Btn, P } from "../components/ui";
import { signoff } from "../copy";
import { firstName, type Lang } from "../i18n";
import type { EmailOutput } from "../types";

type Marketing = {
  lang: Lang;
  unsubscribeUrl: string;
  /** Null only on test sends and previews: real sends are blocked until it is set. */
  postalAddress: string | null;
  bookUrl: string;
};

/** CAN-SPAM: every marketing email says how to stop and where the sender is. */
function MarketingFooter({ lang, unsubscribeUrl, postalAddress }: Marketing) {
  const es = lang === "es";
  return (
    <>
      <P small muted style={{ marginTop: "24px" }}>
        {es ? "Recibes este correo porque aceptaste recibir novedades de Raw Planet. " : "You're getting this because you said yes to news from Raw Planet. "}
        <A href={unsubscribeUrl}>{es ? "Darme de baja" : "Unsubscribe"}</A>
      </P>
      <P small muted>
        {BUSINESS.legalName}, {postalAddress ?? (es ? "(falta la dirección postal)" : "(mailing address not set yet)")}
      </P>
    </>
  );
}

export type CampaignView = Marketing & { subject: string; body: string };

export function campaignEmail(v: CampaignView): EmailOutput {
  const es = v.lang === "es";
  const paragraphs = v.body.trim().split(/\n\s*\n/);
  const element = (
    <Layout lang={v.lang} preview={v.body.trim().slice(0, 90)}>
      {paragraphs.map((p, i) => (
        <P key={i}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </P>
      ))}
      <Actions>
        <Btn href={v.bookUrl}>{es ? "Reservar una sesión" : "Book a session"}</Btn>
      </Actions>
      <P muted>{signoff(v.lang)}</P>
      <MarketingFooter {...v} />
    </Layout>
  );
  return { subject: v.subject, element };
}

export type WinBackView = Marketing & { name: string };

export function winBackEmail(v: WinBackView): EmailOutput {
  const es = v.lang === "es";
  const name = firstName(v.name);
  const subject = es ? `Hace tiempo que no nos vemos, ${name}` : `It's been a while, ${name}`;
  const element = (
    <Layout lang={v.lang} preview={es ? "El estudio sigue aquí cuando quieras volver." : "The studio's here whenever you want to come back."}>
      <P>{es ? `Hola, ${name}:` : `Hi ${name},`}</P>
      <P>
        {es
          ? "Ha pasado un tiempo desde tu última sesión y me acordé de ti. Si tienes ganas de otra canción, otra mezcla o simplemente desconectar un rato, aquí estoy."
          : "It's been a little while since your last session and you crossed my mind. If you're up for another track, another mix or just a reset, I'd love to have you back."}
      </P>
      <Actions>
        <Btn href={v.bookUrl}>{es ? "Reservar otra sesión" : "Book another session"}</Btn>
      </Actions>
      <P muted>{signoff(v.lang)}</P>
      <MarketingFooter {...v} />
    </Layout>
  );
  return { subject, element };
}
