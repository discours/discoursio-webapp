import { clsx } from 'clsx'
import { createSignal, onMount } from 'solid-js'
import { toast } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import styles from './Donate.module.scss'

// biome-ignore lint/suspicious/noExplicitAny: donate widget
type DWindow = Window & { cp: any }

export const Donate = () => {
  const { t } = useLocalize()
  const { showModal } = useUI()
  const once = ''
  const monthly = 'Monthly'
  const cpOptions = {
    publicId: 'pk_0a37bab30ffc6b77b2f93d65f2aed',
    description: t('Help discours to grow'),
    currency: 'RUB'
  }

  let amountSwitchElement: HTMLDivElement | undefined
  let customAmountElement: HTMLInputElement | undefined
  const [widget, setWidget] = createSignal()
  const [customerReciept, setCustomerReciept] = createSignal({})
  const [showingPayment, setShowingPayment] = createSignal<boolean>()
  const [period, setPeriod] = createSignal(monthly)
  const [amount, setAmount] = createSignal(0)

  const initiated = () => {
    try {
      const { cp: CloudPayments } = window as unknown as DWindow

      setWidget(new CloudPayments())
      console.log('[donate] payments initiated')
      setCustomerReciept({
        Items: [
          //товарные позиции
          {
            label: cpOptions.description, //наименование товара
            price: amount() || 0, //цена
            quantity: 1, //количество
            amount: amount() || 0, //сумма
            vat: 20, //ставка НДС
            method: 0, // тег-1214 признак способа расчета - признак способа расчета
            object: 0 // тег-1212 признак предмета расчета - признак предмета товара, работы, услуги, платежа, выплаты, иного предмета расчета
          }
        ],
        // taxationSystem: 0, //система налогообложения; необязательный, если у вас одна система налогообложения
        // email: 'user@example.com', //e-mail покупателя, если нужно отправить письмо с чеком
        // phone: '', //телефон покупателя в любом формате, если нужно отправить сообщение со ссылкой на чек
        isBso: false, //чек является бланком строгой отчетности
        amounts: {
          electronic: amount(), // Сумма оплаты электронными деньгами
          advancePayment: 0, // Сумма из предоплаты (зачетом аванса) (2 знака после запятой)
          credit: 0, // Сумма постоплатой(в кредит) (2 знака после запятой)
          provision: 0 // Сумма оплаты встречным предоставлением (сертификаты, др. мат.ценности) (2 знака после запятой)
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  onMount(() => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://widget.cloudpayments.ru/bundles/cloudpayments.js'
    script.async = true
    script.addEventListener('load', initiated)
    document.head.append(script)
  })

  const show = () => {
    // $openModal = 'donate'
    setShowingPayment(true)
    console.log('[donate] clicked')
    const choice: HTMLInputElement | undefined | null = amountSwitchElement?.querySelector('input[type=radio]:checked')
    setAmount(Number.parseInt(customAmountElement?.value || choice?.value || '0', 10))
    console.log(`[donate] input amount ${amount}`)
    // biome-ignore lint/suspicious/noExplicitAny: it's a widget!
    ;(widget() as any).charge(
      {
        // options
        ...cpOptions,
        amount: amount(),
        skin: 'classic',
        requireEmail: true,
        retryPayment: true,
        // invoiceId: '1234567', //номер заказа  (необязательно)
        // accountId: 'user@example.com', //идентификатор плательщика (обязательно для создания подписки)
        data: {
          CloudPayments: {
            CustomerReciept: customerReciept(),
            recurrent: {
              interval: period(), // local solid's signal
              period: 1, // internal widget's
              CustomerReciept: customerReciept() // чек для регулярных платежей
            }
          }
        }
      },
      // biome-ignore lint/suspicious/noExplicitAny: donate options
      (opts: any) => {
        // success
        // действие при успешной оплате
        console.debug('[donate] options', opts)
        showModal('thank')
      },
      // biome-ignore lint/suspicious/noExplicitAny: donate options
      (reason: string, options: any) => {
        // fail
        // действие при неуспешной оплате
        console.debug('[donate] options', options)

        toast.error(reason)
      }
    )
  }

  return (
    <form class={styles.donateForm} action="" method="post">
      <input type="hidden" name="shopId" value="156465" />
      <input value="148805" name="scid" type="hidden" />
      <input value="0" name="customerNumber" type="hidden" />

      <div class={styles.formGroup}>
        <div class={styles.donateButtonsContainer} ref={amountSwitchElement}>
          <input type="radio" name="amount" id="fix250" value="250" />
          <label for="fix250" class={styles.btn}>
            250&thinsp;₽
          </label>
          <input type="radio" name="amount" id="fix500" value="500" checked />
          <label for="fix500" class={styles.btn}>
            500&thinsp;₽
          </label>
          <input type="radio" name="amount" id="fix1000" value="1000" />
          <label for="fix1000" class={styles.btn}>
            1000&thinsp;₽
          </label>
          <input
            class={styles.donateInput}
            required
            ref={customAmountElement}
            type="number"
            name="sum"
            placeholder={t('Another amount')}
          />
        </div>
      </div>

      <div class={styles.formGroup} id="payment-type" classList={{ showing: showingPayment() }}>
        <div class={clsx(styles.btnGroup, styles.paymentChoose)} data-toggle="buttons">
          <input
            type="radio"
            autocomplete="off"
            id="once"
            name="once"
            onClick={() => setPeriod(once)}
            checked={period() === once}
          />
          <label for="once" class={clsx(styles.btn, styles.paymentType)} classList={{ active: period() === once }}>
            {t('One time')}
          </label>
          <input
            type="radio"
            autocomplete="off"
            id="monthly"
            name="monthly"
            onClick={() => setPeriod(monthly)}
            checked={period() === monthly}
          />
          <label
            for="monthly"
            class={clsx(styles.btn, styles.paymentType)}
            classList={{ active: period() === monthly }}
          >
            {t('Every month')}
          </label>
        </div>
      </div>

      <div class={styles.formGroup}>
        <button type="button" class={clsx(styles.btn, styles.sendBtn)} onClick={show}>
          {t('Help discours to grow')}
        </button>
      </div>
    </form>
  )
}
