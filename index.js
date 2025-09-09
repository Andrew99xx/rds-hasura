// Lambda receives Hasura Event Trigger payload, computes a slug, and updates the row via Hasura GraphQL.
export const handler = async (event) => {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      const newRow = body?.event?.data?.new;
      if (!newRow || !newRow.title || !newRow.id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Bad payload', got: body }) };
      }
  
      const slug = newRow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
      const mutation = `
        mutation Update($id: Int!, $slug: String!) {
          update_tasks_by_pk(pk_columns: {id: $id}, _set: {processed: true, slug: $slug}) {
            id slug processed
          }
        }
      `;
  
      const resp = await fetch(process.env.HASURA_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({ query: mutation, variables: { id: newRow.id, slug } })
      });
  
      const json = await resp.json();
      if (json.errors) {
        console.error('Hasura errors', json.errors);
        return { statusCode: 500, body: JSON.stringify({ ok: false, errors: json.errors }) };
      }
  
      return { statusCode: 200, body: JSON.stringify({ ok: true, slug }) };
    } catch (e) {
      console.error(e);
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  };
  