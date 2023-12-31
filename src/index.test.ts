import handlers from ".";

const controller: ScheduledController = {
  scheduledTime: 1,
  cron: "* * * * *",
  noRetry: () => {},
};

const env = getMiniflareBindings();

const ctx: ExecutionContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
};

describe("test scheduled handler", () => {
  const fetchMock = getMiniflareFetchMock();

  beforeEach(async () => {
    await env.FEED_ITEMS.delete("http://status.aws.amazon.com/sample1");

    fetchMock.disableNetConnect();

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[Amazon Web Services Service Status]]></title>
    <link>http://status.aws.amazon.com/</link>
    <language>en-us</language>
    <lastBuildDate>Wed, 29 Mar 2023 00:05:52 PDT</lastBuildDate>
    <generator>AWS Service Health Dashboard RSS Generator</generator>
    <description><![CDATA[Amazon Web Services Service Status]]></description>
    <ttl>5</ttl>
    <!-- You seem to care about knowing about your events, why not check out https://docs.aws.amazon.com/health/latest/ug/getting-started-api.html -->


	 <item>
	  <title><![CDATA[Ode to Unit Testing]]></title>
	  <link>http://status.aws.amazon.com/</link>
	  <pubDate>Tue, 28 Mar 2023 16:52:00 PDT</pubDate>
	  <guid isPermaLink="false">http://status.aws.amazon.com/sample1</guid>
	  <description><![CDATA[Sample description 1]]></description>
	 </item>
  </channel>
</rss>`;
    fetchMock
      .get("https://status.aws.amazon.com")
      .intercept({ path: `/rss/all.rss`, method: "GET" })
      .reply(200, rssContent);

    const completionContent = {
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: {
            content: "Increasing code coverage,\nLike eating a dry shoe.",
            role: "assistant",
          },
        },
      ],
      created: 1677664795,
      id: "chatcmpl-7QyqpwdfhqwajicIEznoc6Q47XAyW",
      model: "gpt-3.5-turbo-0613",
      object: "chat.completion",
      usage: {
        completion_tokens: 17,
        prompt_tokens: 57,
        total_tokens: 74,
      },
    };
    fetchMock
      .get("https://api.openai.com")
      .intercept({ path: `/v1/chat/completions`, method: "POST" })
      .reply(200, completionContent);

    fetchMock
      .get(env.MSTDN_URL)
      .intercept({ path: `/api/v1/statuses`, method: "POST" })
      .reply(200, {});
  });

  it("should generate and store poem to KV store when status not in KV store", async () => {
    await handlers.scheduled(controller, env, ctx);

    const res = await env.FEED_ITEMS.get(
      "http://status.aws.amazon.com/sample1"
    );
    const expectedRes = `## Ode to Unit Testing ##

Roses are red,
Violets are blue,
Increasing code coverage,
Like eating a dry shoe.

Source: http://status.aws.amazon.com/sample1`;
    expect(res).toBe(expectedRes);
  });

  it("should not generate poem when poem in KV store", async () => {
    await env.FEED_ITEMS.put(
      "http://status.aws.amazon.com/sample1",
      `## Ballad of the Oncall ##

Roses are red,
Violets are blue,
Service in alarm,
And I don't know what to do.

Source: http://status.aws.amazon.com/sample1`
    );

    await handlers.scheduled(controller, env, ctx);

    const res = await env.FEED_ITEMS.get(
      "http://status.aws.amazon.com/sample1"
    );
    const expectedRes = `## Ballad of the Oncall ##

Roses are red,
Violets are blue,
Service in alarm,
And I don't know what to do.

Source: http://status.aws.amazon.com/sample1`;
    expect(res).toBe(expectedRes);
  });
});
