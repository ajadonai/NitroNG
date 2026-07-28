const SCRIPT_OPERATION = 'seed-seo-blog-content';

const newPosts = [
  {
    title: "Is Nitro.ng Legit? An Honest Look at How We Operate",
    slug: "is-nitro-ng-legit",
    excerpt: "Is Nitro.ng legit? Here is exactly how we source services, handle payments, process refills, and what happens when an order fails. No marketing language.",
    content: `If you found this page by searching whether Nitro is legit, you are doing the right thing. Nigerians have been burned by enough social media panels that scepticism is the correct starting position, not rudeness.

So here is the full answer. Not a sales page. How we actually operate, including the parts that are inconvenient for us.

### Who we are

The Nitro NG is a registered Nigerian company based in Lagos. We run nitro.ng, a platform where you fund a wallet in Naira and buy social media promotion services for Instagram, TikTok, YouTube, X, Facebook, Telegram, Spotify and others.

At the time of writing we have processed over {{order_count}} orders across roughly {{user_count}} accounts, with a {{delivery_rate}}% delivery rate across the catalogue. Those numbers are pulled live from our own system and shown on the homepage. They move as we grow.

We are not the oldest panel in Nigeria and we do not claim to be. We launched recently and we are still building.

### How we source services, and why it matters more than price

This is the part most panels will not tell you.

Almost every SMM panel in the world, including ours, buys from upstream wholesale providers. The panel you order from is rarely the one physically delivering. That is not a scandal, it is just how the industry is built.

The difference is what a panel does with that supply.

Most Nigerian panels connect to a provider's API and list the entire catalogue automatically. Thousands of services, no filtering. If the provider lists a service that stopped working three months ago, the panel lists it too. You order, nothing happens, and now both of you are stuck.

We do it the slow way. We pull from multiple upstream providers, then we test services before listing them. Services that deliver inconsistently do not make it onto the site. Services that start dropping badly get pulled. That is why we list around {{service_count}} services rather than several thousand, and it is the main reason our delivery rate sits where it does.

The honest trade off: our catalogue is smaller than panels that list everything raw. If you want an obscure service on a platform nobody uses, we may not have it. We think a smaller list that works beats a huge list that mostly does not.

### How the three tiers actually work

Every service on Nitro sits in one of three tiers. The difference is what happens after delivery.

**Budget.** Cheapest option. No refill. If the numbers drop, they are gone. Fine for testing, fine for views, risky for followers.

**Standard.** Refill covered for 30 days. If followers drop within that window on a refill included service, they get replaced.

**Premium.** Refill covered for the life of the order on services marked for it. Highest quality sources, lowest drop rates, highest price.

Two honest caveats. Refill applies to services that are marked as refill included, not to every service on the site. And refill replaces drops, it does not undo a platform purge that removes an entire batch of accounts. Nobody can promise that.

### How payments work

You fund a Nitro wallet, then spend from the wallet. We do not charge your card per order.

Payments are processed through Flutterwave, which means bank transfer, debit and credit cards, and every Nigerian bank and wallet Flutterwave supports. Opay, PalmPay, Kuda, Moniepoint, GTBank, Access, Zenith, First Bank, UBA and the rest. We also accept crypto.

Minimum deposit is ₦1,000. Deposit ₦2,500 or more on your first deposit and you get free promotion credit on top, up to ₦3,000 depending on the amount. That credit is spend only. It buys services on Nitro. It cannot be withdrawn as cash, and we say so plainly at the point you claim it.

We never ask for your social media password. Ever. We only need your public profile link or post link. If any panel asks for your login details, close the tab.

### What happens when an order fails

This is the question that actually matters, so here is the specific answer.

If an order does not start, the money goes back to your Nitro wallet as credit you can spend on another service. It does not go back to your bank account. That is our policy and it is written into our terms.

We are telling you this plainly because a lot of panels write "money back guarantee" and quietly mean the same thing. We would rather you know before you deposit than feel misled after.

If an order partially delivers, you are charged for what was delivered and the balance returns to your wallet.

If an order stalls, message us on WhatsApp. We do not run a ticket system where your issue sits in a queue overnight. Support is a real WhatsApp line answered by people, mostly within minutes during Lagos hours.

### What we cannot do

- We cannot guarantee zero drops. Anyone who does is either lying or does not understand the product.
- We cannot guarantee a platform will never take action on your account. Instagram, TikTok and YouTube all update their detection systems, and no provider on earth controls that.
- We cannot make bad content perform. Promotion increases how many people see something. It does not make them care. If the content is weak, more views just means more people scrolling past.
- We cannot refund to your bank account. Wallet credit only.

### How to check us out without trusting us

Do not take our word for any of this. Do this instead:

1. Deposit the minimum, ₦1,000. That is genuinely all it takes to test us.
2. Buy a small order on a cheap service. Reel views cost a few hundred Naira per thousand, so a small amount is a real test.
3. Watch whether it starts, whether the tracker matches reality, and how fast WhatsApp replies.
4. Then decide whether to fund properly.

We built the ₦1,000 minimum for exactly this reason. A scam needs you to deposit big before you find out. We would rather you spend ₦1,000 finding out we are real.

### Who Nitro is not for

We would rather lose the sale than have this go badly, so here are the people we are a poor fit for.

**If you expect promotion to replace content.** More views on a weak video means more people scrolling past it. We can get your work in front of people. We cannot make them care.

**If you need the money refundable to your bank.** Wallet credit only. If that is a dealbreaker, it is better you know now.

**If you want the absolute cheapest price in the market.** We are not it, and we are not trying to be. Testing services and pulling the ones that degrade costs money, and that cost is in the price. If price is your only criterion, someone will always be cheaper than us, and you will find out why.

**If you want a guarantee that nothing can go wrong.** It does not exist anywhere in this industry, from anyone, at any price.

### If you are still unsure

Search around. Check our Trustpilot profile, our Google Business listing and our Instagram and X accounts at @TheNitroNG. Ask us anything on WhatsApp before you spend a Naira. We would rather answer twenty questions than take money from someone who is not comfortable.

If you want to try it, [sign up at nitro.ng](/signup), fund with ₦1,000, and run one small order. That is the whole test.`,
    category: "Guides",
    published: true,
    showInHowTo: false,
    sortOrder: 10,
  },
  {
    title: "SMM Panel Scams in Nigeria: Red Flags Before You Pay",
    slug: "smm-panel-scams-nigeria-red-flags",
    excerpt: "Nine warning signs that a Nigerian SMM panel will take your money and disappear, and the checks that take five minutes before you deposit.",
    content: `If a Nigerian SMM panel has already taken your money and gone quiet, you are not careless. You are one of thousands. The category attracts scams because the barrier to entry is almost zero. Anyone can buy a ready made panel script, point it at a payment link, run ads for two weeks and vanish.

Here is how to spot them before you pay.

### 1. No company details anywhere

Look for a registered company name, an RC number, and a physical location. Not a Gmail address and a phone number.

A registered Nigerian company has something to lose. An anonymous site has nothing. This single check filters out most of the bad ones.

### 2. Payment goes to a personal account

If checkout means sending money to a personal bank account or a personal Opay number, stop. Legitimate businesses use a payment processor. Flutterwave, Paystack, a proper merchant setup.

Personal account transfers exist for one reason: they are hard to reverse and hard to trace.

### 3. Prices that make no sense

There is a floor to what social media promotion costs, because the panel is buying it wholesale from someone else. If a panel is charging far below everyone in the market, one of three things is true. They are using the cheapest bot accounts that will drop within days. They are running at a loss to collect deposits before disappearing. Or they simply will not deliver.

Cheap is not automatically a scam. Impossibly cheap is.

### 4. Massive catalogue, zero curation

A panel listing fifteen thousand services has not tested fifteen thousand services. It has connected to a provider API and mirrored the whole thing.

This is not always malicious, but the effect on you is the same. Half those listings are dead. You order, nothing happens, and the panel has no idea why because they never looked at the service in the first place.

### 5. No refund policy, or a vague one

Read the refund page before you deposit. You are looking for specifics. What happens if an order does not start. What happens if it partially delivers. Whether refunds go to your wallet or your bank.

"Money back guarantee" with no detail underneath it is a marketing phrase, not a policy. Most panels that say it mean wallet credit. The honest ones tell you that upfront.

### 6. Delivery counts that do not match reality

This one catches a lot of people. Some panels show a progress tracker that counts up on a timer rather than reporting what actually happened.

Test it. Screenshot your follower count before you order. Check it against what the panel claims. If the panel says 5,000 delivered and your account gained 900, you have your answer.

### 7. Support that only exists before you pay

Message support before you deposit. Ask a specific question. Then notice how fast they reply and whether the answer is a real answer.

Now compare that to how they respond after a problem. Panels that go quiet the moment something goes wrong tell you everything. If the only contact route is a form that emails into a void, assume the void.

### 8. Fake reviews you can check

Testimonial walls with stock photos and first names are worth nothing. Neither is a "4.9 from 900 reviews" badge that does not link anywhere.

Click the badge. If it does not open a real Trustpilot or Google listing where you can read the reviews and see the dates, it is decoration.

### 9. Pressure and countdown timers

A permanent countdown timer that resets when you reload is a lie you can verify in ten seconds. Urgency that is manufactured tells you the rest of the site is probably manufactured too.

### 10. A domain registered three weeks ago

This is the check almost nobody runs and it catches a lot.

Every domain has a public registration date. Go to any free whois lookup, paste the panel's domain, and look at the creation date. A panel advertising heavily on a domain registered last month is a pattern, and the pattern is usually collect deposits, then disappear, then register a new domain and repeat.

A young domain is not automatically a scam. Every real business was new once, ours included. But a young domain combined with aggressive advertising, no company details and a big minimum deposit is three red flags stacked on top of each other.

### 11. Only a Telegram group, no real website

Some operations run entirely out of a WhatsApp or Telegram group. You send money, someone tells you it is done, and there is no dashboard, no order history and no record of anything.

If there is no account you can log into and no order history you can check, you have no way to prove what you bought. When it goes wrong, and it will, you have a chat log and nothing else.

### 12. The minimum deposit is high

Watch this one closely, because it inverts the incentive.

A panel confident in its product wants you to test it cheaply, because a small successful order becomes a large one. A panel planning to disappear wants your first deposit to be as large as possible, because there will not be a second one.

If a panel will not let you test with a small amount, ask yourself why that is.

### The five minute check before any deposit

Run this on any panel, including ours.

1. Find the company name and registration. If neither exists, stop.
2. Check where the money goes. Payment processor, not personal account.
3. Read the refund page properly. Wallet credit or bank? Specifics or vibes?
4. Message support with a real question. Time the reply.
5. Deposit the minimum and run one small order before you commit anything real.

Step five is the one that actually protects you. Any panel with a low minimum deposit lets you test cheaply. Any panel that requires a large first deposit before you can try anything is asking you to trust it blind.

### What to do if you have already been scammed

Report the account to your bank immediately. Nigerian banks can sometimes freeze a receiving account if you move fast enough. Report to the Nigeria Police cybercrime unit and to the EFCC through their official channels. Post the details on Nairaland and in the creator groups you belong to, because the next person searching that panel's name deserves to find your warning.

Then, when you try again, run the five minute check.

### Where we stand

We are a Nigerian SMM panel, so treat this section with appropriate suspicion.

The Nitro NG is a registered Nigerian company in Lagos. Payments run through Flutterwave, not a personal account. Our minimum deposit is ₦1,000 specifically so you can test us cheaply instead of trusting us blindly. Support is a real WhatsApp line. Refunds go to your Nitro wallet as spendable credit, not to your bank, and we say that on the refund page rather than hiding it under a guarantee badge.

We list around {{service_count}} services instead of thousands because we test them before listing. That is a smaller catalogue and we think it is the right trade.

Do not take our word for it. Run the five minute check on us the same way you would on anyone else.

Check out our [reviews page](/reviews) to see what using Nitro is actually like.`,
    category: "Guides",
    published: true,
    showInHowTo: false,
    sortOrder: 11,
  },
  {
    title: "Will Instagram Ban Me for Buying Followers? The Honest Answer",
    slug: "will-instagram-ban-me-for-buying-followers",
    excerpt: "What Instagram actually detects, what it actually does about it, and how to reduce your risk. An honest answer with no guarantees attached.",
    content: `Short answer: a permanent ban purely for buying followers is rare. Reduced reach, removed followers and a flagged account are much more common. And nobody, including us, can promise you zero risk.

Here is the longer version, because the details matter.

### What Instagram actually cares about

Instagram is not scanning for "this person bought followers". It is scanning for account behaviour that looks automated, and for accounts in its network that look fake.

Two different things get caught, and it helps to keep them separate.

**Accounts that follow you.** If the accounts following you are empty shells with no profile picture, no posts and no history, Instagram eventually removes them from the platform. This is a purge. It is not aimed at you. It affects accounts that never bought anything, because fake accounts follow real people too.

**Your own account behaviour.** If your account is doing the automating, logging in from strange places, running follow and unfollow loops, using a third party tool that has your password, that is when Instagram acts against you directly. This is the genuinely risky category, and it is why you should never give any panel your password.

Buying followers puts you in the first category. Using a bot tool that logs into your account puts you in the second. The second is far more dangerous.

### What actually happens, in order of likelihood

**Most likely: the followers disappear.** Instagram purges the fake accounts, your count drops, nothing else happens.

**Fairly likely on a bad order: reduced reach.** A sudden spike of engagement from accounts that never interact with anything else can make your engagement rate look strange. Low engagement relative to follower count is a signal Instagram weighs. Ten thousand followers who never like anything can make your posts reach fewer people than one thousand engaged ones did.

**Possible: an action block.** Temporary restrictions on following, liking or commenting. Usually clears in hours or days.

**Uncommon: shadowban style suppression.** Your content stops appearing in hashtags and Explore. Usually recovers over a few weeks of normal posting.

**Rare from purchased followers alone: account disable.** This mostly happens to accounts doing multiple things wrong at once, especially handing login credentials to automation tools.

### The thing people get wrong about "safe"

There is no safe. There is lower risk and higher risk.

Higher risk looks like: fifty thousand followers dumped on a new account overnight, from bot accounts, on a page with four posts, followed by nothing.

Lower risk looks like: a gradual delivery, spread over days, onto an account that is actively posting, at a volume that is plausible for the account's size.

The difference is not really about the followers. It is about whether the growth curve looks like something that could have happened.

### Practical rules that actually reduce risk

**Start small.** Your first order should be a few hundred, not fifty thousand. See what happens before you scale.

**Use gradual delivery.** Our drip feed option spreads a large order over days instead of dumping it at once. It is optional and you can switch it on when ordering. This is the single most useful setting for looking natural.

**Match the volume to the account.** An account with 400 followers jumping to 40,000 in a day is not a growth story anyone believes, including the algorithm. Grow in proportion.

**Keep posting.** An account that receives engagement but produces nothing looks exactly like what it is. Consistent posting is the strongest counter signal you have.

**Space your orders.** Weeks between orders, not hours.

**Never hand over your password.** No promotion service needs it. If one asks, that is a bot tool wearing a panel's clothing, and it is the highest risk thing you can do.

**Buy engagement, not just followers.** Followers with zero likes on your posts is the pattern that hurts reach. If you are adding followers, add some likes and views to the posts too so the ratio stays sane.

### The one thing that actually gets accounts banned

If you take nothing else from this article, take this.

The accounts that get disabled are almost never the ones that bought followers. They are the ones that handed their login details to a growth tool.

Those tools log into your account and perform actions as you. Following, unfollowing, liking, commenting, DMing, on a loop, from a server that is not your phone and not in your city. That is automation of your account, which is the thing Instagram's rules are actually written about, and it is what triggers real enforcement.

A promotion service that only ever sees your public profile link cannot do any of that. It has no access to your account. The worst outcome available to it is that some accounts following you get removed later.

So the practical hierarchy of risk, from worst to mildest:

1. Giving a tool your password so it can act as you. Genuinely dangerous.
2. Buying huge volumes of cheap bot engagement on a small account, fast. Recoverable, but it can suppress your reach for weeks.
3. Buying moderate, gradually delivered engagement on an active account. Lowest risk available, and still not zero.

Nobody should be telling you option three is risk free. They should be telling you it is the least risky version of something that carries risk.

### What to do if your account is already restricted

**If you have an action block.** Stop everything. No posting, no following, no liking for 24 to 48 hours. Most action blocks clear on their own. Do not keep trying the action that triggered it.

**If your reach has collapsed.** Stop ordering. Post normally for two to three weeks and let the ratio settle. Engagement from real people is what recovers reach, and buying more on top of a suppressed account makes it worse.

**If you have been given a warning.** Take it seriously and pause everything for a month. A second warning is a much bigger problem than the first.

**If you gave a tool your password.** Change it immediately, everywhere you reused it, and turn on two factor authentication. This is urgent in a way the other situations are not.

### Does this apply to TikTok, YouTube and X too?

Broadly yes, with differences.

TikTok cares less about follower count and more about watch time and completion rate, so bought followers affect reach less there, but bought views on a video with poor retention can flatten its distribution. See our [TikTok services](/services/tiktok) for more.

YouTube is the strictest of the major platforms, especially anywhere near monetisation. Watch hours and subscribers that do not behave like real viewers can put a monetisation application at risk. Be conservative on YouTube. See our [YouTube services](/services/youtube).

X is generally the most tolerant of the four. See our [X services](/services/x).

### What we do about it, and what we do not promise

We use gradual delivery on services that support it, and we test services before listing them precisely because the low quality bot sources are the ones that get purged hardest. Our refill covered services replace drops within their window.

What we do not do is promise you are safe. We will not put that in writing because it would not be true. Any panel that guarantees your account is safe is telling you something they cannot control.

If you want the lower risk version: start with a small order, turn on gradual delivery, keep posting, and grow in proportion to where your account actually is. That is genuinely the whole strategy.

If you want to test it cheaply, the minimum deposit on Nitro is ₦1,000. Small enough to find out for yourself without betting anything you would miss. [Sign up here](/signup).`,
    category: "Guides",
    published: true,
    showInHowTo: false,
    sortOrder: 12,
  },
  {
    title: "SMM Panels That Accept Opay, PalmPay, Kuda and Bank Transfer",
    slug: "smm-panel-opay-palmpay-kuda-bank-transfer",
    excerpt: "How to pay for social media promotion in Nigeria using Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, or crypto. What works, what does not, and why.",
    content: `A lot of Nigerians cannot use most SMM panels for one boring reason: payment. The international panels want a card that works internationally, or PayPal, or a crypto wallet. If you bank with Opay or PalmPay and you have never touched crypto, most of the internet is closed to you.

Here is what actually works in Nigeria, and how it works on Nitro.

### Why the payment method is the real barrier

Foreign panels price in dollars and charge through processors that mostly do not like Nigerian cards. Even when a payment goes through, you are paying an FX rate you did not choose plus whatever your bank adds on top.

Meanwhile, a huge share of Nigerians now run their day to day money through Opay, PalmPay, Kuda and Moniepoint rather than a traditional bank card. Those work perfectly well domestically and badly or not at all on foreign checkout pages.

So the practical question is not "which panel is best". It is "which panel can I actually pay".

### What we accept

Nitro processes payments through Flutterwave, which is a Nigerian payment processor. That means we accept what Flutterwave accepts, which is most of the Nigerian financial system.

**Bank transfer.** Transfer from any Nigerian bank account. GTBank, Access, Zenith, First Bank, UBA, Fidelity, Stanbic, Sterling, Wema, FCMB, Union, Polaris, Keystone and the rest.

**Digital banks and wallets.** Opay, PalmPay, Kuda, Moniepoint, VBank, Rubies, Sparkle. If it can send a Naira transfer or issue a card, it works.

**Debit and credit cards.** Verve, Mastercard and Visa cards issued in Nigeria. No international card required.

**USSD.** For when data is being difficult.

**Crypto.** For anyone who prefers it. Processed separately through NOWPayments.

Everything is priced in Naira. There is no dollar conversion anywhere in the flow, so the price you see is the price you pay.

### How the wallet works, and why it exists

Nitro is wallet based. You fund your Nitro wallet once, then place orders against the balance. You are not putting your card details in for every single order.

Two reasons this is better for you. You pay one transaction fee on the deposit rather than a fee on every small order. And you can place a ₦200 order without a payment page being involved at all.

Minimum deposit is ₦1,000. That is deliberately low so you can test the platform without committing real money.

If your first deposit is ₦2,500 or more, you get free promotion credit added on top, scaling up to ₦3,000 free at the top tier. That credit is spend only. It buys services on Nitro and cannot be withdrawn as cash. We would rather say that clearly than let you find out later.

### Is paying with a wallet like Opay any different from a bank?

No, and this trips people up more than it should.

Opay, PalmPay, Kuda and Moniepoint are licensed financial institutions with their own bank codes. When you send a transfer from Opay, it moves through the same national payment rails as a transfer from GTBank. As far as our checkout is concerned there is no difference at all.

The reason those wallets fail on foreign sites is not that they are somehow lesser. It is that foreign checkout pages are built around international card networks, and a Nigerian wallet card is not designed for that. On a Nigerian processor the problem simply does not exist.

So if you have been told you need a "proper bank account" to buy promotion services, that is wrong. Whatever you use for your daily spending works here.

### Are there deposit fees?

We do not add a fee on top of your deposit. Your bank or wallet may apply its own transfer charge, which is between you and them and is usually small.

### What happens to money you do not spend

It stays in your wallet. There is no expiry on your deposited balance.

If an order fails to start, the amount returns to your wallet as credit you can spend on something else. It does not return to your bank account. That is our policy and it is on the refund page, not buried in the terms.

### What paying a foreign panel actually costs you

Worth doing the maths, because the sticker price on a foreign panel is not the price you pay.

A dollar priced service looks cheap until you add the exchange rate your bank applies rather than the one you saw quoted, plus a foreign transaction fee, plus the risk that the payment simply fails and you are left chasing it. On a small order the fees can be a meaningful share of what you spent.

Then there is the failure rate. Nigerian cards get declined on foreign checkout pages constantly, and when a payment fails partway you sometimes still see a hold on your account for days.

Naira pricing removes all of that. The number on the service is the number that leaves your wallet. There is no second conversion happening somewhere you cannot see.

### Common payment problems, and what to do

**"My transfer went out but my wallet is empty."**
Usually a delay in confirmation rather than a lost payment. Give it a few minutes. If it is still not showing, message us on WhatsApp with the transfer reference and the email on your account, and we will match it manually.

**"My card was declined."**
Most often an international transaction block on your card, or a daily limit. Try a bank transfer instead, which avoids the card network entirely and is usually the more reliable route in Nigeria anyway.

**"I sent from a different account than the one on my Nitro profile."**
Not a problem. Send us the reference on WhatsApp and we will match it to your account.

**"Can I deposit more than my daily transfer limit?"**
Yes, in multiple deposits. Your wallet balance simply accumulates. There is no maximum wallet balance and no expiry on funds you have deposited.

### Which method should you use?

**Bank transfer** if you want the lowest friction and you are funding a reasonable amount. It clears fast and there is no card involved.

**Card** if you want it instant and you already have the card saved.

**Opay, PalmPay, Kuda or Moniepoint** exactly the same as any bank. Transfer from the app or use the card. Nothing special required.

**Crypto** if you already hold it. There is no advantage otherwise, and the conversion adds steps.

### The short version

If you have a Nigerian bank account, a Nigerian digital wallet, a Nigerian card, or crypto, you can pay on Nitro. Everything is in Naira. Minimum is ₦1,000.

If you have been unable to use a panel because your Opay or PalmPay card kept getting declined on a foreign checkout page, that is the problem we built around. [Sign up at nitro.ng](/signup), fund with ₦1,000 from whatever you already use, and see whether it works for you.

Browse our [Instagram](/services/instagram), [TikTok](/services/tiktok), [YouTube](/services/youtube), [X](/services/x), [Facebook](/services/facebook), [Telegram](/services/telegram), and [Spotify](/services/spotify) services.`,
    category: "Guides",
    published: true,
    showInHowTo: false,
    sortOrder: 13,
  },
];

const dropsRewrite = {
  title: "Why SMM Followers Drop, And How to Avoid It",
  excerpt: "Why purchased followers drop, what a refill actually covers, and how to compare drop rates between panels before you buy.",
  content: `You bought followers. The number went up. A few days later it started going down. This is the single most common experience people have with SMM services, and most panels explain it badly because a proper explanation costs them sales.

Here is the full version, including how to compare panels on this specific thing.

### First, drops are normal. Total drops are not.

Every purchased follower service loses some accounts. A well sourced service on Instagram might lose 5% to 15% over the first few weeks. A cheap bot service can lose 40% to 70%, sometimes within days.

So "did I lose followers" is the wrong question. "How many did I lose, over what period, and was it replaced" is the right one.

### The four reasons drops happen

**1. Platform purges.** Instagram, TikTok and the rest periodically sweep their networks for accounts that look fake, inactive or automated. When a purge runs, any of those accounts following you disappear.

This is worth being clear about: a purge is not a penalty on your account. It is the platform cleaning its own house. Accounts that have never bought a single follower lose followers in purges too, because fake accounts follow real people.

Purges are also the reason no refill can be absolute. If a platform deletes an entire cohort of accounts, a refill can replace them with new ones, but nobody can stop the deletion.

**2. The accounts were low quality to begin with.** This is the biggest controllable factor and it maps almost exactly to price.

A panel selling followers at a fraction of everyone else's price is buying from the cheapest sources. Bot accounts with no picture, no posts and no bio drop 40% to 70%. Low quality accounts with basic profiles drop 20% to 40%. High quality accounts with pictures and some posting history drop 5% to 15%. Premium accounts with established looking profiles drop under 10%.

The price difference is the quality difference. There is no secret cheap supply of good accounts.

**3. Natural unfollows.** Some accounts used in these services unfollow after a period. Organic followers also unfollow over time. The difference is that with purchased followers it happens in visible batches rather than one at a time.

**4. Detection updates.** When a platform improves its detection, accounts that previously passed the filter stop passing it. This causes sudden market wide drops that hit every panel at once. If your followers dropped on the same week as everyone else's, this is usually why.

### What a refill actually covers, in detail

"Refill guarantee" gets used loosely, so here is exactly what it means on Nitro.

**Budget tier: no refill.** What arrives is what you keep. This tier exists because for some services, refill is irrelevant. Views do not unfollow you. Buying Budget for reel views is sensible. Buying Budget for followers is a gamble you are choosing to take.

**Standard tier: refill for 30 days.** If the count drops below what you ordered within 30 days, on a service marked refill included, the shortfall gets replaced. You do not need to do anything for the automatic ones. If it has not triggered after a few days, message us.

**Premium tier: refill for the life of the order.** Same mechanism, no expiry window, on services marked for it. Sourced from the highest quality suppliers we have, which is why the drop rate is lowest here before refill even matters.

Three honest limits on all of that:

- Refill applies to services marked refill included. Not every service on the site carries it. It is shown on the service before you order.
- Refill restores the count. It does not deliver the same accounts back.
- Refill covers drops. It does not cover you deleting the post, going private, or the account being restricted, because there is nothing for the system to refill into.

### How to compare drop rates between panels before you buy

Most people compare panels on price. Price is the least useful number. Here is what to compare instead.

**1. Cost per retained follower, not cost per follower.** The cheap service that drops 50% is not half the price of the quality service that drops 10%. Adjusted for what survives, the gap closes fast. Now add that the cheap one has no refill and the quality one does, and the gap closes further.

**2. Whether refill is stated per service or claimed site wide.** A panel that puts refill terms on each individual service is telling you the truth. A panel with a "refill guarantee" badge in the header and no per service detail is making a marketing claim.

**3. What the refill window actually is.** 30 days is standard. Lifetime exists on premium services. "Refill guarantee" with no stated period usually means no refill.

**4. Whether the panel curates.** A panel listing thousands of services has not tested them. Drop rate is a property of the supplier behind each service. If the panel never evaluated the supplier, they cannot tell you the drop rate, and they will not know when it gets worse.

**5. Run your own test.** Screenshot your follower count. Order 1,000 on the tier you are considering. Screenshot again at 24 hours, 7 days and 30 days. That gives you a real drop rate for that panel, on that service, at that tier. It costs a few thousand Naira and it beats every review you will read, including this one.

### Drop rates are not the same on every platform

Worth knowing before you assume a service is bad.

**Instagram** purges hardest and most often. This is the platform where drops are most visible and where refill earns its keep.

**TikTok** drops less on followers, but views and likes on a video can be adjusted downward if TikTok decides the engagement was not genuine. That looks like a drop and behaves like one.

**YouTube** removes subscribers in sweeps and is the strictest platform overall. Expect drops and treat anything near monetisation carefully.

**X** is the most tolerant of the four. Drops happen but tend to be smaller and slower.

**Facebook and Telegram** sit in the middle. Telegram post views do not drop at all, since a view is a recorded event rather than an ongoing subscription.

So a 12% drop on Instagram and a 12% drop on X are not the same signal. The first is normal, the second suggests the source was weaker than it should have been.

### How to minimise drops in practice

**Buy the right tier for the service.** Views and reach do not drop. Followers and likes do. Spending Premium money on views is waste. Spending Budget money on followers is how you end up here.

**Use gradual delivery.** Spreading an order over days instead of dumping it looks more natural and tends to survive better. It is an option at checkout.

**Do not overshoot your account size.** A page with 500 followers jumping to 50,000 attracts exactly the attention you do not want.

**Keep posting.** An account that receives followers and posts nothing is the clearest possible signal of what happened. Regular posting is the cheapest way to keep what you gained, and it costs nothing.

**Add engagement, not just followers.** Followers with no likes on your posts is the ratio that damages reach. Balance them.

**Space your orders out.** Weeks, not hours.

### What to do when a drop happens

**Wait 48 hours before doing anything.** Some of what looks like a drop is delivery settling. A 5% to 10% dip in the first week on a quality service is within normal.

**Check the service and tier you bought.** Open the order. If the service was marked refill included and you are inside the window, refill should trigger on its own.

**Message us on WhatsApp if it has not.** Send the order ID. We do not run a ticket queue. A person will look at it.

**If the drop is far outside what the tier should produce, tell us.** That is useful information. It means the supplier behind that service has degraded, and it is exactly the signal that gets a service pulled from our catalogue.

### The bottom line

Drops are a normal feature of this product, not a sign you were scammed. What separates a good panel from a bad one is not whether drops happen. It is the size of the drop, whether the refill terms are stated honestly per service, and whether anyone is watching supplier quality over time.

On Nitro, refill covered services replace drops automatically within their tier window, and we test services before listing them, which is why our catalogue is around {{service_count}} services rather than several thousand. We cannot promise zero drops and we will not, because that promise would not be true from anyone.

If you want to see the drop rate for yourself, the cheapest honest test is a 1,000 unit order on Standard and three screenshots over a month.

Read our [reviews page](/reviews) to see what using Nitro is actually like, or [sign up](/signup) and test with ₦1,000.`,
};

const DROPS_SLUGS = [
  'why-smm-followers-drop-how-to-avoid-it',
  'why-instagram-followers-drop-after-buying',
];

async function main({ prisma, dryRun, logger = console }) {
  logger.log(`${dryRun ? 'Previewing' : 'Seeding'} SEO blog posts...`);

  for (const post of newPosts) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: post.slug } });
    if (existing) {
      logger.log(`  Skipped (exists): ${post.title}`);
      continue;
    }
    if (dryRun) {
      logger.log(`  [dry] Would create: ${post.title}`);
      continue;
    }
    await prisma.blogPost.create({ data: { ...post, authorName: 'Nitro Team' } });
    logger.log(`  Created: ${post.title}`);
  }

  let dropsUpdated = false;
  for (const slug of DROPS_SLUGS) {
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      if (dryRun) {
        logger.log(`  [dry] Would update drops post: ${slug}`);
      } else {
        await prisma.blogPost.update({
          where: { slug },
          data: {
            title: dropsRewrite.title,
            excerpt: dropsRewrite.excerpt,
            content: dropsRewrite.content,
          },
        });
        logger.log(`  Updated drops post: ${slug}`);
      }
      dropsUpdated = true;
      break;
    }
  }
  if (!dropsUpdated) {
    logger.log(`  Drops post not found at any expected slug (${DROPS_SLUGS.join(', ')}). Creating new.`);
    if (!dryRun) {
      await prisma.blogPost.create({
        data: {
          title: dropsRewrite.title,
          slug: DROPS_SLUGS[0],
          excerpt: dropsRewrite.excerpt,
          content: dropsRewrite.content,
          category: 'Guides',
          published: true,
          showInHowTo: false,
          sortOrder: 14,
          authorName: 'Nitro Team',
        },
      });
      logger.log(`  Created drops post at slug: ${DROPS_SLUGS[0]}`);
    }
  }

  const count = await prisma.blogPost.count();
  logger.log(`\n${dryRun ? 'Preview complete' : 'Done'}. ${count} current blog posts.`);
  return { dryRun, currentCount: count, newPosts: newPosts.length };
}

if (require.main === module) {
  import('./lib/guarded-operation.mjs')
    .then(({ runGuardedPrismaScript }) => runGuardedPrismaScript({
      operation: SCRIPT_OPERATION,
      main,
    }))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = { SCRIPT_OPERATION, main, newPosts, dropsRewrite };
