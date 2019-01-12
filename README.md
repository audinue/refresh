# Refresh

Write this...

```html
<script src="https://audinue.github.io/refresh/refresh.min.js"></script>
<script>
    var name = 'John'
</script>

<p>Name: <input value="{name}" oninput="name=this.value"></p>
<p>Hello {name}!</p>
```

And you get this...

![Demo](demo.gif)

Visit the [playground](https://audinue.github.io/refresh/playground.html) to learn more.

## Notes

- Call `refresh()` to update the DOM outside of HTML.
- `<p align="{align}">Hello {name}!</p>`
- `this` refers to the owning element.
- `<tag for="value[, key] in expression"></tag>` creates new scope.
- `<tag if="expression"></tag>`
- `safe-*` for edge-cases like `<input type="number" safe-value="{foo}">`
- Two way data binding:
    - `value-source="expression"` also works for `<select>` for WebKit only.
    - `checked-source="expression"` accepts boolean, array and other.
- `template="name(parameters)"` and `apply="name(arguments)"`
- Handle `autofocus` well.
