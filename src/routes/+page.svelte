<script>
  let greeting = 'Welcome to SvelteKit JRM';
	let a = $state(1);
	let b = $state(2);
</script>

<label>
	<input type="number" value={a} min="0" max="10" />
	<input type="range" value={a} min="0" max="10" />
</label>

<label>
	<input type="number" value={b} min="0" max="10" />
	<input type="range" value={b} min="0" max="10" />
</label>

<p>{a} + {b} = {a + b}</p>


<main>
  <h1>{greeting}</h1>
  <p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 3em;
    font-weight: 100;
  }
</style>